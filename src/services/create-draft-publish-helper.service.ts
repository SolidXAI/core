import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EntityManager, FindOptionsWhere, In, SelectQueryBuilder } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { RelationType, SolidFieldType } from "../dtos/create-field-metadata.dto";
import { CommonEntity } from "../entities/common.entity";
import { FieldMetadata } from "../entities/field-metadata.entity";
import { Media } from "../entities/media.entity";
import { ModelMetadata } from "../entities/model-metadata.entity";
import { SolidBaseRepository } from "../repository/solid-base.repository";

type TransformDtoResult = {
    dto: any;
    hasMediaFields: boolean;
};

type DraftPublishCrudContext<T extends CommonEntity> = {
    repo: SolidBaseRepository<T>;
    modelName: string;
    moduleName: string;
    validateAndTransformDto: (
        field: FieldMetadata,
        dto: any,
        files: Express.Multer.File[],
        hasMediaFields: boolean,
        isPartialUpdate?: boolean,
        isUpdate?: boolean,
        entityId?: number,
    ) => Promise<TransformDtoResult>;
    saveMedia: (model: ModelMetadata, files: Express.Multer.File[], savedEntity: T) => Promise<void>;
    getDatasourceDefaultEntityManager: () => EntityManager;
    getColumnDatabaseName: (propertyName: string) => string;
    escapeDatabaseName: (databaseName: string) => string;
};

export class DraftPublishHelperService {
    isDraftPublishEnabled(model: ModelMetadata): boolean {
        return model?.draftPublishWorkflow === true;
    }

    assertDraftPublishWorkflowEnabled(model: ModelMetadata, modelName: string): void {
        if (!this.isDraftPublishEnabled(model)) {
            throw new BadRequestException(`Publish workflow is not enabled for ${modelName}`);
        }
    }

    assertUpdateAllowed<T extends CommonEntity>(model: ModelMetadata, entity: T, modelName: string): void {
        if (!this.isDraftPublishEnabled(model)) return;
        if (entity.isLatest === false) {
            throw new BadRequestException(`Only the latest version of ${modelName} can be updated.`);
        }
    }

    shouldCopyPublishedVersionForUpdate<T extends CommonEntity>(model: ModelMetadata, entity: T): boolean {
        return this.isDraftPublishEnabled(model) && entity.isPublished === true;
    }

    applyCreateDefaults(model: ModelMetadata, createDto: any): void {
        if (!this.isDraftPublishEnabled(model)) return;
        createDto.isLatest = true;
        createDto.isPublished = false;
        createDto.publishedAt = null;
        createDto.publishedTracker = "na";
    }

    async ensureInitialEntityVersionId<T extends CommonEntity>(
        model: ModelMetadata,
        repo: SolidBaseRepository<T>,
        savedEntity: T,
    ): Promise<T> {
        if (!this.isDraftPublishEnabled(model) || savedEntity.initialEntityVersionId) return savedEntity;
        savedEntity.initialEntityVersionId = savedEntity.id;
        return repo.save(savedEntity) as Promise<T>;
    }

    applyDraftPublishFilterDefaults(
        qb: SelectQueryBuilder<any>,
        filters: any,
        entityAlias: string,
    ): void {
        const hasIsLatestFilter = this.filtersContainField(filters, 'isLatest');
        const hasInitialVersionFilter = this.filtersContainField(filters, 'initialEntityVersionId');
        const isPublishedViewRequested = this.filtersContainBooleanValue(filters, 'isPublished', true);
        const shouldApplyDefaultLatestFilter = !isPublishedViewRequested && !hasIsLatestFilter && !hasInitialVersionFilter;

        if (shouldApplyDefaultLatestFilter) {
            qb.andWhere(`${entityAlias}.isLatest = :defaultIsLatest`, { defaultIsLatest: true });
        }
    }

    filtersContainField(filters: any, fieldName: string): boolean {
        if (!filters || typeof filters !== 'object') return false;
        const normalizedFilters = this.normalizeObjectKeys(filters);
        return Object.keys(normalizedFilters).some(key => {
            const [rawField] = key.split(':');
            if (rawField === fieldName) return true;
            const value = normalizedFilters[key];
            if (key === '$and' || key === '$or') {
                return Array.isArray(value) && value.some((nestedFilter: any) => this.filtersContainField(nestedFilter, fieldName));
            }
            return value && typeof value === 'object' && this.filtersContainField(value, fieldName);
        });
    }

    async copyPublishedVersionAndUpdate<T extends CommonEntity>(
        context: DraftPublishCrudContext<T>,
        id: number,
        updateDto: any,
        files: Express.Multer.File[],
        isPartialUpdate: boolean,
        model: ModelMetadata,
    ): Promise<T> {
        const relationNames = this.getVersionedRelationNames(model);
        const sourceEntity = await context.repo.findOne({
            where: { id } as unknown as FindOptionsWhere<T>,
            relations: relationNames as any,
        });

        if (!sourceEntity) {
            throw new Error(`Entity [${context.moduleName}.${context.modelName}] with id ${id} not found`);
        }

        let hasMediaFields = false;
        const submittedDto = { ...updateDto };
        let transformedDto = { ...updateDto };

        for (const field of model.fields) {
            const transformed = await context.validateAndTransformDto(field, transformedDto, files, hasMediaFields, isPartialUpdate, false);
            transformedDto = transformed.dto;
            hasMediaFields = transformed.hasMediaFields;
        }

        const newVersionPayload = this.buildNewVersionPayload(context.repo, sourceEntity, relationNames);

        for (const field of model.fields) {
            if (this.wasFieldSubmitted(submittedDto, field) && Object.prototype.hasOwnProperty.call(transformedDto, field.name)) {
                newVersionPayload[field.name] = transformedDto[field.name];
            }
        }

        const chainId = sourceEntity.initialEntityVersionId || sourceEntity.id;
        newVersionPayload.initialEntityVersionId = chainId;
        newVersionPayload.isLatest = true;
        newVersionPayload.isPublished = false;
        newVersionPayload.publishedAt = null;
        newVersionPayload.publishedTracker = this.createTemporaryPublishedVersionTracker();

        const savedVersion = await context.repo.manager.transaction(async (manager) => {
            const transactionalRepo = manager.getRepository(context.repo.metadata.target);

            await manager
                .createQueryBuilder()
                .update(context.repo.metadata.target)
                .set({ isLatest: false } as any)
                .where(`${context.escapeDatabaseName(context.getColumnDatabaseName('isLatest'))} = :isLatest`, { isLatest: true })
                .andWhere(`(${context.escapeDatabaseName(context.getColumnDatabaseName('initialEntityVersionId'))} = :chainId OR ${context.escapeDatabaseName(context.getColumnDatabaseName('id'))} = :chainId)`, { chainId })
                .callListeners(false)
                .execute();

            const newVersion = transactionalRepo.create(newVersionPayload);
            let persistedVersion = await transactionalRepo.save(newVersion) as unknown as T;
            persistedVersion.publishedTracker = this.createPublishedVersionTracker(persistedVersion.id);
            persistedVersion = await transactionalRepo.save(persistedVersion as any) as unknown as T;

            await this.cloneMediaForVersion(context, model, sourceEntity.id, persistedVersion, files, manager);

            return persistedVersion;
        });

        if (hasMediaFields) {
            await context.saveMedia(model, files, savedVersion);
        }

        return savedVersion;
    }

    async assertDraftPublishDeleteAllowed<T extends CommonEntity>(
        repo: SolidBaseRepository<T>,
        modelName: string,
        entities: T[],
    ): Promise<void> {
        const ids = entities.map(entity => entity.id).filter(Boolean);
        if (ids.length === 0) return;

        const currentPublishedEntities = await repo.find({
            where: {
                id: In(ids),
                isPublished: true,
            } as FindOptionsWhere<T>,
        });

        if (currentPublishedEntities.length > 0) {
            const currentPublishedEntityIds = currentPublishedEntities.map(entity => entity.id);
            throw new BadRequestException(
                `Published ${modelName} record cannot be deleted. Publish another draft or unpublish it before deleting. Invalid Ids ${currentPublishedEntityIds.join(', ')}.`
            );
        }
    }

    markDeletedDraftPublishVersionsAsNotLatest<T extends CommonEntity>(model: ModelMetadata, entities: T[]): void {
        if (!this.isDraftPublishEnabled(model)) return;
        for (const entity of entities) {
            if (entity.isLatest === true) {
                entity.isLatest = false;
            }
        }
    }

    getLatestDraftPublishChainIds<T extends CommonEntity>(entities: T[]): number[] {
        return Array.from(new Set(
            entities
                .filter(entity => entity.isLatest === true)
                .map(entity => entity.initialEntityVersionId || entity.id)
        ));
    }

    getEntityIds<T extends CommonEntity>(entities: T[]): number[] {
        return entities.map(entity => entity.id).filter(Boolean);
    }

    async promoteLatestDraftPublishVersionAfterDelete<T extends CommonEntity>(
        repo: SolidBaseRepository<T>,
        deletedLatestChainIds: number[],
        deletedIds: number[],
    ): Promise<void> {
        if (deletedLatestChainIds.length === 0) return;

        for (const chainId of deletedLatestChainIds) {
            const replacementQuery = repo.manager
                .createQueryBuilder(repo.metadata.target, 'entity')
                .where('(entity.initialEntityVersionId = :chainId OR entity.id = :chainId)', { chainId })
                .orderBy('entity.createdAt', 'DESC')
                .addOrderBy('entity.id', 'DESC');

            if (deletedIds.length > 0) {
                replacementQuery.andWhere('entity.id NOT IN (:...deletedIds)', { deletedIds });
            }

            const replacement = await replacementQuery.getOne() as T | null;
            if (!replacement) continue;

            await repo.manager
                .createQueryBuilder()
                .update(repo.metadata.target)
                .set({ isLatest: false } as any)
                .where('(initial_entity_version_id = :chainId OR id = :chainId)', { chainId })
                .execute();

            await repo.update(replacement.id, { isLatest: true } as unknown as QueryDeepPartialEntity<T>);
        }
    }

    async publishRecord<T extends CommonEntity>(
        repo: SolidBaseRepository<T>,
        model: ModelMetadata,
        modelName: string,
        id: number,
        activeUser?: any,
    ): Promise<T> {
        this.assertDraftPublishWorkflowEnabled(model, modelName);

        const entity = await repo.findOne({ where: { id } as any });
        if (!entity) {
            throw new NotFoundException(`${modelName} with id ${id} not found`);
        }

        if (entity.isLatest === false) {
            throw new BadRequestException(`Only the latest version of ${modelName} can be published.`);
        }

        if (entity.isPublished) {
            throw new BadRequestException(`${modelName} with id ${id} is already published`);
        }

        const chainId = entity.initialEntityVersionId || entity.id;

        return repo.manager.transaction(async (manager) => {
            const transactionalRepo = manager.getRepository(repo.metadata.target);
            const chainVersions = await transactionalRepo.find({
                where: [
                    { initialEntityVersionId: chainId },
                    { id: chainId },
                ] as any,
            }) as unknown as T[];
            const archivedVersions = chainVersions
                .filter(version => version.id !== entity.id)
                .map(version => ({
                    ...version,
                    isPublished: false,
                    publishedTracker: this.createPublishedVersionTracker(version.id),
                }));

            if (archivedVersions.length > 0) {
                await transactionalRepo.save(archivedVersions as any);
            }

            return transactionalRepo.save({
                ...entity,
                initialEntityVersionId: chainId,
                isPublished: true,
                publishedAt: new Date(),
                publishedTracker: "na",
                updatedBy: activeUser?.sub ?? entity.updatedBy,
            } as any) as Promise<T>;
        });
    }

    async unpublishRecord<T extends CommonEntity>(
        repo: SolidBaseRepository<T>,
        model: ModelMetadata,
        modelName: string,
        id: number,
        activeUser?: any,
    ): Promise<T> {
        this.assertDraftPublishWorkflowEnabled(model, modelName);

        const entity = await repo.findOne({ where: { id } as any });
        if (!entity) {
            throw new NotFoundException(`${modelName} with id ${id} not found`);
        }

        if (entity.isLatest === false) {
            throw new BadRequestException(`Only the latest version of ${modelName} can be unpublished.`);
        }

        if (!entity.isPublished) {
            throw new BadRequestException(`${modelName} with id ${id} is already unpublished`);
        }

        return repo.save({
            ...entity,
            isPublished: false,
            updatedBy: activeUser?.sub ?? entity.updatedBy,
        });
    }

    private normalizeObjectKeys(obj: any): any {
        return Object.keys(obj).reduce((acc, key) => {
            const newKey = key.replace(/^\[(.*)\]$/, '$1');
            acc[newKey] = obj[key];
            return acc;
        }, {});
    }

    private normalizeBooleanFilterValue(value: boolean | string | undefined): boolean | undefined {
        if (value === undefined || value === null || value === '') return undefined;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const normalized = value.toLowerCase();
            if (normalized === 'true') return true;
            if (normalized === 'false') return false;
        }
        return undefined;
    }

    private filtersContainBooleanValue(filters: any, fieldName: string, expectedValue: boolean): boolean {
        if (!filters || typeof filters !== 'object') return false;
        const normalizedFilters = this.normalizeObjectKeys(filters);

        return Object.keys(normalizedFilters).some(key => {
            const [rawField] = key.split(':');
            const value = normalizedFilters[key];
            if (rawField === fieldName) {
                return this.extractBooleanFilterValues(value).includes(expectedValue);
            }
            if (key === '$and' || key === '$or') {
                return Array.isArray(value) && value.some((nestedFilter: any) => this.filtersContainBooleanValue(nestedFilter, fieldName, expectedValue));
            }
            return value && typeof value === 'object' && this.filtersContainBooleanValue(value, fieldName, expectedValue);
        });
    }

    private extractBooleanFilterValues(filterValue: any): boolean[] {
        if (filterValue === undefined || filterValue === null) return [];
        const directValue = this.normalizeBooleanFilterValue(filterValue);
        if (directValue !== undefined) return [directValue];
        if (Array.isArray(filterValue)) {
            return filterValue
                .map(value => this.normalizeBooleanFilterValue(value))
                .filter((value): value is boolean => value !== undefined);
        }
        if (typeof filterValue !== 'object') return [];

        const normalizedValue = this.normalizeObjectKeys(filterValue);
        return Object.keys(normalizedValue)
            .filter(operator => operator === '$eq' || operator === '$in')
            .flatMap(operator => this.extractBooleanFilterValues(normalizedValue[operator]));
    }

    private getVersionedRelationNames(model: ModelMetadata): string[] {
        return model.fields
            .filter(field => field.type === SolidFieldType.relation && field.relationType !== RelationType.oneToMany)
            .map(field => field.name);
    }

    private wasFieldSubmitted(dto: any, field: FieldMetadata): boolean {
        if (!dto) return false;
        if (Object.prototype.hasOwnProperty.call(dto, field.name)) return true;
        if (field.type !== SolidFieldType.relation) return false;
        if (Object.prototype.hasOwnProperty.call(dto, `${field.name}Id`)) return true;
        if (Object.prototype.hasOwnProperty.call(dto, `${field.name}Ids`)) return true;
        if (Object.prototype.hasOwnProperty.call(dto, `${field.name}UserKey`)) return true;
        if (Object.prototype.hasOwnProperty.call(dto, `${field.name}Command`)) return true;
        if (field.relationCoModelFieldName) {
            if (Object.prototype.hasOwnProperty.call(dto, `${field.relationCoModelFieldName}Ids`)) return true;
            if (Object.prototype.hasOwnProperty.call(dto, `${field.relationCoModelFieldName}Command`)) return true;
        }
        return false;
    }

    private buildNewVersionPayload<T extends CommonEntity>(
        repo: SolidBaseRepository<T>,
        sourceEntity: T,
        relationNames: string[],
    ): any {
        const newVersionPayload: any = {};
        const excludedColumns = new Set([
            'id',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'createdBy',
            'updatedBy',
            'publishedAt',
            'isPublished',
            'isLatest',
            'initialEntityVersionId',
            'publishedTracker',
        ]);

        repo.metadata.columns.forEach(column => {
            if (!excludedColumns.has(column.propertyName)) {
                newVersionPayload[column.propertyName] = sourceEntity[column.propertyName];
            }
        });

        for (const relationName of relationNames) {
            newVersionPayload[relationName] = sourceEntity[relationName];
        }

        return newVersionPayload;
    }

    private async cloneMediaForVersion<T extends CommonEntity>(
        context: DraftPublishCrudContext<T>,
        model: ModelMetadata,
        sourceEntityId: number,
        targetEntity: T,
        files: Express.Multer.File[] = [],
        entityManager?: EntityManager,
    ): Promise<void> {
        const mediaFields = model.fields.filter(field => field.type === SolidFieldType.mediaSingle || field.type === SolidFieldType.mediaMultiple);
        if (mediaFields.length === 0) return;

        const uploadedFieldNames = new Set(files.map(file => file.fieldname));
        const mediaRepository = (entityManager ?? context.getDatasourceDefaultEntityManager()).getRepository(Media);

        for (const mediaField of mediaFields) {
            if (uploadedFieldNames.has(mediaField.name)) continue;

            const sourceMedia = await mediaRepository.find({
                where: {
                    entityId: sourceEntityId,
                    modelMetadata: { id: model.id },
                    fieldMetadata: { id: mediaField.id },
                } as any,
                relations: {
                    modelMetadata: true,
                    mediaStorageProviderMetadata: true,
                    fieldMetadata: true,
                } as any,
            });

            for (const media of sourceMedia) {
                const clonedMedia = mediaRepository.create({
                    entityId: targetEntity.id,
                    relativeUri: media.relativeUri,
                    fileSize: media.fileSize,
                    mimeType: media.mimeType,
                    originalFileName: media.originalFileName,
                    modelMetadata: media.modelMetadata,
                    mediaStorageProviderMetadata: media.mediaStorageProviderMetadata,
                    fieldMetadata: media.fieldMetadata,
                });
                await mediaRepository.save(clonedMedia);
            }
        }
    }

    private createPublishedVersionTracker(seed: number | string): string {
        return `version:${seed}`;
    }

    private createTemporaryPublishedVersionTracker(): string {
        return `version:pending:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    }
}
