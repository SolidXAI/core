import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EntityManager, FindOptionsWhere, In, SelectQueryBuilder } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { DRAFT_PUBLISH_VERSIONING_FIELD_NAMES } from "../constants/draft-publish-fields";
import { RelationType, SolidFieldType } from "../dtos/create-field-metadata.dto";
import { CommonEntity } from "../entities/common.entity";
import { FieldMetadata } from "../entities/field-metadata.entity";
import { Media } from "../entities/media.entity";
import { ModelMetadata } from "../entities/model-metadata.entity";
import { SolidBaseRepository } from "../repository/solid-base.repository";
import { normalizeObjectKeys } from "./object.utils";

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
        return this.someFilterLeaf(filters, fieldName, () => true);
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
        // Snapshot of what the caller actually submitted, used only for hasOwnProperty checks
        // below; the transform pipeline works off its own copy (transformedDto) so this
        // reference never needs to be cloned.
        const submittedDto = updateDto;
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

    assertDraftPublishDeleteAllowed<T extends CommonEntity>(
        modelName: string,
        entities: T[],
    ): void {
        // The caller just loaded these entities, so their isPublished flags are already
        // current — no need to re-query the DB for the same rows.
        const currentPublishedEntityIds = entities
            .filter(entity => entity.isPublished === true)
            .map(entity => entity.id);

        if (currentPublishedEntityIds.length > 0) {
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

        // Chains are independent of one another, so promote replacements concurrently
        // rather than awaiting one chain at a time.
        await Promise.all(deletedLatestChainIds.map(chainId =>
            this.promoteReplacementForChain(repo, chainId, deletedIds)
        ));
    }

    private async promoteReplacementForChain<T extends CommonEntity>(
        repo: SolidBaseRepository<T>,
        chainId: number,
        deletedIds: number[],
    ): Promise<void> {
        const replacementQuery = repo.manager
            .createQueryBuilder(repo.metadata.target, 'entity')
            .where('(entity.initialEntityVersionId = :chainId OR entity.id = :chainId)', { chainId })
            .orderBy('entity.createdAt', 'DESC')
            .addOrderBy('entity.id', 'DESC');

        if (deletedIds.length > 0) {
            replacementQuery.andWhere('entity.id NOT IN (:...deletedIds)', { deletedIds });
        }

        const replacement = await replacementQuery.getOne() as T | null;
        if (!replacement) return;

        await repo.manager
            .createQueryBuilder()
            .update(repo.metadata.target)
            .set({ isLatest: false } as any)
            .where('(initial_entity_version_id = :chainId OR id = :chainId)', { chainId })
            .execute();

        await repo.update(replacement.id, { isLatest: true } as unknown as QueryDeepPartialEntity<T>);
    }

    async publishRecord<T extends CommonEntity>(
        repo: SolidBaseRepository<T>,
        model: ModelMetadata,
        modelName: string,
        id: number,
        activeUser?: any,
    ): Promise<T> {
        const entity = await this.loadLatestEntityForPublishAction(repo, model, modelName, id, 'published');

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
        const entity = await this.loadLatestEntityForPublishAction(repo, model, modelName, id, 'unpublished');

        if (!entity.isPublished) {
            throw new BadRequestException(`${modelName} with id ${id} is already unpublished`);
        }

        return repo.save({
            ...entity,
            isPublished: false,
            updatedBy: activeUser?.sub ?? entity.updatedBy,
        });
    }

    /**
     * Load the latest version of a draft/publish-enabled record for a publish/unpublish
     * action, applying the two checks both actions share (workflow enabled, version is latest).
     */
    private async loadLatestEntityForPublishAction<T extends CommonEntity>(
        repo: SolidBaseRepository<T>,
        model: ModelMetadata,
        modelName: string,
        id: number,
        action: 'published' | 'unpublished',
    ): Promise<T> {
        this.assertDraftPublishWorkflowEnabled(model, modelName);

        const entity = await repo.findOne({ where: { id } as any });
        if (!entity) {
            throw new NotFoundException(`${modelName} with id ${id} not found`);
        }

        if (entity.isLatest === false) {
            throw new BadRequestException(`Only the latest version of ${modelName} can be ${action}.`);
        }

        return entity;
    }

    /**
     * Walk a (possibly nested, $and/$or-combined) filters object looking for any leaf keyed
     * by `fieldName`, delegating the leaf test to the caller. Shared by filtersContainField
     * (any occurrence counts) and filtersContainBooleanValue (occurrence must match a value).
     */
    private someFilterLeaf(filters: any, fieldName: string, matchesLeaf: (value: any) => boolean): boolean {
        if (!filters || typeof filters !== 'object') return false;
        const normalizedFilters = normalizeObjectKeys(filters);

        return Object.keys(normalizedFilters).some(key => {
            const [rawField] = key.split(':');
            const value = normalizedFilters[key];
            if (rawField === fieldName) return matchesLeaf(value);
            if (key === '$and' || key === '$or') {
                return Array.isArray(value) && value.some((nestedFilter: any) => this.someFilterLeaf(nestedFilter, fieldName, matchesLeaf));
            }
            return value && typeof value === 'object' && this.someFilterLeaf(value, fieldName, matchesLeaf);
        });
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
        return this.someFilterLeaf(filters, fieldName, value => this.extractBooleanFilterValues(value).includes(expectedValue));
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

        const normalizedValue = normalizeObjectKeys(filterValue);
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
            ...DRAFT_PUBLISH_VERSIONING_FIELD_NAMES,
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
        const clonableFieldIds = mediaFields
            .filter(field => !uploadedFieldNames.has(field.name))
            .map(field => field.id);
        if (clonableFieldIds.length === 0) return;

        const mediaRepository = (entityManager ?? context.getDatasourceDefaultEntityManager()).getRepository(Media);

        // One query for every clonable media field instead of one query per field.
        const sourceMedia = await mediaRepository.find({
            where: {
                entityId: sourceEntityId,
                modelMetadata: { id: model.id },
                fieldMetadata: { id: In(clonableFieldIds) },
            } as any,
            relations: {
                modelMetadata: true,
                mediaStorageProviderMetadata: true,
                fieldMetadata: true,
            } as any,
        });
        if (sourceMedia.length === 0) return;

        // Reuse the same underlying file across versions instead of physically duplicating it
        // in storage; MediaService.deletePhysicalFile guards against removing the file while
        // another Media row still references it. Saved as a single batch instead of one insert
        // per row.
        const clonedMedia = sourceMedia.map(media => mediaRepository.create({
            entityId: targetEntity.id,
            relativeUri: media.relativeUri,
            fileSize: media.fileSize,
            mimeType: media.mimeType,
            originalFileName: media.originalFileName,
            modelMetadata: media.modelMetadata,
            mediaStorageProviderMetadata: media.mediaStorageProviderMetadata,
            fieldMetadata: media.fieldMetadata,
        }));
        await mediaRepository.save(clonedMedia);
    }

    private createPublishedVersionTracker(seed: number | string): string {
        return `version:${seed}`;
    }

    private createTemporaryPublishedVersionTracker(): string {
        return `version:pending:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    }
}
