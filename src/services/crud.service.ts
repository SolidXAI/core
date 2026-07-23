import { BadRequestException, ConflictException, HttpException, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { isArray } from "class-validator";
import { CommonEntity } from "../entities/common.entity";
import { User } from "../entities/user.entity";
import { SolidBaseRepository } from "../repository/solid-base.repository";
import { SettingService } from "./setting.service";
import { ERROR_MESSAGES } from "src/constants/error-messages";
import { SUCCESS_MESSAGES } from "src/constants/success-messages";
import { EntityManager, FindOptionsWhere, In, IsNull, Not, QueryFailedError, SelectQueryBuilder } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { BasicFilterDto } from "../dtos/basic-filters.dto";
import { ComputedFieldValueType, RelationType, SelectionValueType, SolidFieldType } from "../dtos/create-field-metadata.dto";
import { MediaStorageProviderType } from "../dtos/create-media-storage-provider-metadata.dto";
import { FieldMetadata } from "../entities/field-metadata.entity";
import { Media } from "../entities/media.entity";
import { ModelMetadata } from "../entities/model-metadata.entity";
import { BigIntFieldCrudManager } from "../helpers/field-crud-managers/BigIntFieldCrudManager";
import { BooleanFieldCrudManager } from "../helpers/field-crud-managers/BooleanFieldCrudManager";
import { ComputedFieldCrudManager } from "../helpers/field-crud-managers/ComputedFieldCrudManager";
import { DateFieldCrudManager } from "../helpers/field-crud-managers/DateFieldCrudManager";
import { DecimalFieldCrudManager } from "../helpers/field-crud-managers/DecimalFieldCrudManager";
import { EmailFieldCrudManager, MAX_EMAIL_LENGTH } from "../helpers/field-crud-managers/EmailFieldCrudManager";
import { IntFieldCrudManager } from "../helpers/field-crud-managers/IntFieldCrudManager";
import { JsonFieldCrudManager } from "../helpers/field-crud-managers/JsonFieldCrudManager";
import { LongTextFieldCrudManager } from "../helpers/field-crud-managers/LongTextFieldCrudManager";
import { ManyToManyRelationFieldCrudManager, ManyToManyRelationFieldOptions } from "../helpers/field-crud-managers/ManyToManyRelationFieldCrudManager";
import { ManyToOneRelationFieldCrudManager, ManyToOneRelationFieldOptions } from "../helpers/field-crud-managers/ManyToOneRelationFieldCrudManager";
import { MediaFieldCrudManager, SolidMediaType } from "../helpers/field-crud-managers/MediaFieldCrudManager";
import { NoOpsFieldCrudManager } from "../helpers/field-crud-managers/NoOpsFieldCrudManager";
import { OneToManyRelationFieldCrudManager, OneToManyRelationFieldOptions } from "../helpers/field-crud-managers/OneToManyRelationFieldCrudManager";
import { PasswordFieldCrudManager } from "../helpers/field-crud-managers/PasswordFieldCrudManager";
import { RichTextFieldCrudManager } from "../helpers/field-crud-managers/RichTextFieldCrudManager";
import { SelectionDynamicFieldCrudManager } from "../helpers/field-crud-managers/SelectionDynamicFieldCrudManager";
import { SelectionStaticFieldCrudManager } from "../helpers/field-crud-managers/SelectionStaticFieldCrudManager";
import { ShortTextFieldCrudManager } from "../helpers/field-crud-managers/ShortTextFieldCrudManager";
import { UUIDFieldCrudManager } from "../helpers/field-crud-managers/UUIDFieldCrudManager";
import { ModelMetadataHelperService } from "src/helpers/model-metadata-helper.service";
import { FieldCrudManager, MediaWithFullUrl } from "../interfaces";
import { CrudHelperService, FilterCombinator, UserIdFields } from "./crud-helper.service";
import { HashingService } from "./hashing.service";
import { SolidRegistry } from "src/helpers/solid-registry";
import { getMediaStorageProvider } from "./mediaStorageProviders";
import { ModelMetadataService } from "./model-metadata.service";
import { RequestContextService } from "./request-context.service";

const AUDIT_BEFORE_SNAPSHOT = '__auditBeforeSnapshot';

export class CRUDService<T extends CommonEntity> { // Add two generic value i.e Person,CreatePersonDto, so we get the proper types in our service

    private _modelMetadataService: ModelMetadataService;
    private _crudHelperService: CrudHelperService;
    private _discoveryService: DiscoveryService;
    private _settingService: SettingService;

    constructor(
        readonly entityManager: EntityManager,
        readonly repo: SolidBaseRepository<T>,
        readonly modelName: string,
        readonly moduleName: string,
        readonly moduleRef: ModuleRef,
        readonly defaultDatasourceEntityManager?: EntityManager
    ) { }

    protected get modelMetadataService(): ModelMetadataService {
        return this._modelMetadataService ??= this.moduleRef.get(ModelMetadataService, { strict: false });
    }

    protected get crudHelperService(): CrudHelperService {
        return this._crudHelperService ??= this.moduleRef.get(CrudHelperService, { strict: false });
    }

    protected get discoveryService(): DiscoveryService {
        return this._discoveryService ??= this.moduleRef.get(DiscoveryService, { strict: false });
    }

    protected get settingService(): SettingService {
        return this._settingService ??= this.moduleRef.get(SettingService, { strict: false });
    }

    private async tryCreateAsExtensionUser(createDto: any): Promise<T | null> {
        if (this.repo.metadata?.parentEntityMetadata?.target !== User) return null;
        const registry = this.moduleRef.get(SolidRegistry, { strict: false });
        if (!registry?.getExtensionUserCreationProvider()) {
            throw new InternalServerErrorException(
                `No ExtensionUserCreationProvider registered. Register one to create ${this.repo.metadata.name} entities.`,
            );
        }
        const { AuthenticationService } = await import('./authentication.service');
        const authService = this.moduleRef.get(AuthenticationService, { strict: false });
        return authService.signUp(createDto) as unknown as T;
    }

    async create(createDto: any, files: Express.Multer.File[] = [], solidRequestContext: any = {}): Promise<T> {
        const asExtensionUser = await this.tryCreateAsExtensionUser(createDto);
        if (asExtensionUser !== null) return asExtensionUser;

        // This class will be extended by the generated service class i.e PersonService
        // The data required to identify the model and module name will be passed from the generate CrudService subclass
        //TODO: Algorithm to create the entity
        // 1. Fire a query and load all the fields in the provided model name for a particular module
        // FIXME This can be optimized to take in module name i.e (handle scenario wherein same model exists in multiple modules)
        let hasMediaFields = false;

        const model = await this.loadModel();
        // Check wheather user has create permission for model
        if (solidRequestContext.activeUser) {
            const hasPermission = this.crudHelperService.hasCreatePermissionOnModel(solidRequestContext.activeUser, model.singularName);
            if (!hasPermission) {
                throw new BadRequestException(ERROR_MESSAGES.FORBIDDEN);
            }
        }
        // const inverseRelationFields = await this.loadInverseRelationFields();
        const fieldsToProcess = [...model.fields];

        // 2. Loop through the fields with a switch statement
        // 3. Handle the fields based on field type
        for (const field of fieldsToProcess) {
            const transformed = await this.validateAndTransformDto(field, createDto, files, hasMediaFields);
            createDto = transformed.dto;
            hasMediaFields = transformed.hasMediaFields;
        };
        try {
            // 5. Save the entity
            // For media, we need to use a storage provider and save the media, then save the associated uri against the entity or media table
            if (model.draftPublishWorkflow === true) {
                createDto.isLatest = true;
                createDto.isPublished = false;
                createDto.publishedAt = null;
                createDto.publishedTracker = "na";
            }
            const entity = this.repo.create(createDto);
            let savedEntity = await this.repo.save(entity) as unknown as T;

            if (model.draftPublishWorkflow === true && !savedEntity.initialEntityVersionId) {
                savedEntity.initialEntityVersionId = savedEntity.id;
                savedEntity = await this.repo.save(savedEntity) as unknown as T;
            }

            // 6. Save the media
            if (hasMediaFields) {
                await this.saveMedia(model, files, savedEntity);
            }
            return savedEntity;
        } catch (error: any) {
            if (error instanceof QueryFailedError && error.message.includes('duplicate key value violates unique constraint')) {
                throw new BadRequestException(ERROR_MESSAGES.DUPLICATE_ENTRY);
            }
            throw error;
        }
    }

    private async loadModel() {
        return await this.modelMetadataService.findOneBySingularName(this.modelName, {
            fields: {
                model: {
                    userKeyField: true
                },
                mediaStorageProvider: true,
            },
            module: true,
        });
    }

    private async validateAndTransformDto(field: FieldMetadata, dto: any, files: Express.Multer.File[], hasMediaFields: boolean, isPartialUpdate: boolean = false, isUpdate: boolean = false, entityId?: number) {
        const fieldManager: FieldCrudManager = await this.fieldCrudManager(field, this.entityManager, isPartialUpdate, isUpdate, entityId);
        const validationErrors = fieldManager.validate(dto, files);
        const errors = (validationErrors instanceof Promise) ? await validationErrors : validationErrors;
        if (errors.length > 0) {
            throw new BadRequestException(`Validation errors in ${field.name} is invalid i.e ${errors.map(e => e.error).join(', ')}`); //FIXME: Better to return a validation error object
        }
        const dtoOrPromise = fieldManager.transformForCreate(dto);
        dto = (dtoOrPromise instanceof Promise) ? await dtoOrPromise : dtoOrPromise;
        hasMediaFields = hasMediaFields || field.type === 'mediaSingle' || field.type === 'mediaMultiple';
        return { dto, hasMediaFields };
    }

    private async saveMedia(model: ModelMetadata, files: Express.Multer.File[], savedEntity: T): Promise<void> {
        // Get all the media fields in the dto
        const mediaFields = model.fields.filter(field => field.type === 'mediaSingle' || field.type === 'mediaMultiple');

        // Depending upon media storage provider configured, get the appropriate storage provider
        // Using Promise.all to save all media fields in parallel
        await Promise.all(mediaFields.map(async (mediaField) => {
            const media = files.filter(multerFile => multerFile.fieldname === mediaField.name);

            // If media is present, then save the media
            if (media.length > 0) {
                const storageProviderMetadata = mediaField.mediaStorageProvider;

                // Use the storage provider metadata to get the appropriate storage provider implementation
                const storageProviderType = storageProviderMetadata.type as MediaStorageProviderType;

                // Get the storage provider implementation
                const storageProvider = await getMediaStorageProvider(this.moduleRef, storageProviderType);

                await storageProvider.store(media, savedEntity, mediaField);
            }
        }));
    }

 //TODO: Will the updates be partial i.e PATCH or full i.e PUT
    async update(id: number, updateDto: any, files: Express.Multer.File[] = [], isPartialUpdate: boolean = false, solidRequestContext: any = {}, isUpdate: boolean = false): Promise<T> {
        if (!id) {
            throw new Error(ERROR_MESSAGES.ID_REQUIRED_FOR_UPDATE);
        }
        isUpdate = true;
        const model = await this.loadModel();
        // Check wheather user has update permission for model
        if (solidRequestContext.activeUser) {
            const hasPermission = this.crudHelperService.hasUpdatePermissionOnModel(solidRequestContext.activeUser, model.singularName);
            if (!hasPermission) {
                throw new BadRequestException(ERROR_MESSAGES.FORBIDDEN);
            }
        }
        const entity = await this.repo.findOne({
            where: {
                id: id,
            } as unknown as FindOptionsWhere<T>,
        });
        if (!entity) {
            throw new Error(`Entity [${this.moduleName}.${this.modelName}] with id ${id} not found`);
        }

        if (model.draftPublishWorkflow === true && entity.isLatest === false) {
            throw new BadRequestException(`Only the latest version of ${this.modelName} can be updated.`);
        }

        if (model.draftPublishWorkflow === true && entity.isPublished) {
            return this.createVersionFromUpdate(id, updateDto, files, isPartialUpdate, model);
        }

        // Capture pre-update many-to-many relation state for audit tracking
        await this.prepareManyToManyAuditSnapshot(entity,id,model.singularName);
        let hasMediaFields = false;

        const fieldsToProcess = [...model.fields];

        // 2. Loop through the fields with a switch statement
        // 3. Handle the fields based on field type
        for (const field of fieldsToProcess) {
            const transformed = await this.validateAndTransformDto(field, updateDto, files, hasMediaFields, isPartialUpdate, isUpdate, id);
            updateDto = transformed.dto;
            hasMediaFields = transformed.hasMediaFields;
        }

        // 5. Save the entity
        // For media, we need to use a storage provider and save the media, then save the associated uri against the entity or media table
        const mergedEntity = this.repo.merge(entity, updateDto);
        delete mergedEntity.updatedAt;
        const savedEntity = await this.repo.save(mergedEntity) as T;

        //FIXME: Skip the many-to-many, and instead fire differential updates and avoid loading the entire association graph for the ids

        // 6. Save the media
        if (hasMediaFields) {
            await this.saveMedia(model, files, savedEntity);
        }
        return savedEntity;
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

    private getColumnDatabaseName(propertyName: string): string {
        const column = this.repo.metadata.findColumnWithPropertyName(propertyName);
        if (!column) {
            throw new Error(`Column ${propertyName} not found in entity ${this.repo.metadata.name}`);
        }
        return column.databaseName;
    }

    private escapeDatabaseName(databaseName: string): string {
        return this.repo.manager.connection.driver.escape(databaseName);
    }

    private createPublishedVersionTracker(seed: number | string): string {
        return `version:${seed}`;
    }

    private createTemporaryPublishedVersionTracker(): string {
        return `version:pending:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    }

    private async createVersionFromUpdate(id: number, updateDto: any, files: Express.Multer.File[], isPartialUpdate: boolean, model: ModelMetadata): Promise<T> {
        if (model.draftPublishWorkflow !== true) {
            throw new BadRequestException(`Draft publish workflow is not enabled for ${this.modelName}`);
        }

        const relationNames = this.getVersionedRelationNames(model);
        const sourceEntity = await this.repo.findOne({
            where: { id } as unknown as FindOptionsWhere<T>,
            relations: relationNames as any,
        });

        if (!sourceEntity) {
            throw new Error(`Entity [${this.moduleName}.${this.modelName}] with id ${id} not found`);
        }

        let hasMediaFields = false;
        const submittedDto = { ...updateDto };
        let transformedDto = { ...updateDto };

        for (const field of model.fields) {
            const transformed = await this.validateAndTransformDto(field, transformedDto, files, hasMediaFields, isPartialUpdate, false);
            transformedDto = transformed.dto;
            hasMediaFields = transformed.hasMediaFields;
        }

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

        this.repo.metadata.columns.forEach(column => {
            if (!excludedColumns.has(column.propertyName)) {
                newVersionPayload[column.propertyName] = sourceEntity[column.propertyName];
            }
        });

        for (const relationName of relationNames) {
            newVersionPayload[relationName] = sourceEntity[relationName];
        }

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

        const savedVersion = await this.repo.manager.transaction(async (manager) => {
            const transactionalRepo = manager.getRepository(this.repo.metadata.target);

            await manager
                .createQueryBuilder()
                .update(this.repo.metadata.target)
                .set({ isLatest: false } as any)
                .where(`${this.escapeDatabaseName(this.getColumnDatabaseName('isLatest'))} = :isLatest`, { isLatest: true })
                .andWhere(`(${this.escapeDatabaseName(this.getColumnDatabaseName('initialEntityVersionId'))} = :chainId OR ${this.escapeDatabaseName(this.getColumnDatabaseName('id'))} = :chainId)`, { chainId })
                .callListeners(false)
                .execute();

            const newVersion = transactionalRepo.create(newVersionPayload);
            let persistedVersion = await transactionalRepo.save(newVersion) as unknown as T;
            persistedVersion.publishedTracker = this.createPublishedVersionTracker(persistedVersion.id);
            persistedVersion = await transactionalRepo.save(persistedVersion as any) as unknown as T;

            await this.cloneMediaForVersion(model, sourceEntity.id, persistedVersion, files, manager);

            return persistedVersion;
        });

        if (hasMediaFields) {
            await this.saveMedia(model, files, savedVersion);
        }

        return savedVersion;
    }

    private async cloneMediaForVersion(model: ModelMetadata, sourceEntityId: number, targetEntity: T, files: Express.Multer.File[] = [], entityManager?: EntityManager): Promise<void> {
        const mediaFields = model.fields.filter(field => field.type === SolidFieldType.mediaSingle || field.type === SolidFieldType.mediaMultiple);
        if (mediaFields.length === 0) return;

        const uploadedFieldNames = new Set(files.map(file => file.fieldname));
        const mediaRepository = (entityManager ?? this.getDatasourceDefaultEntityManager()).getRepository(Media);

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

/**
 * Captures the current state of audit-enabled many-to-many relations
 * before the entity is updated. The snapshot is attached to the entity
 * and can be used later for audit comparison.
 */
private async prepareManyToManyAuditSnapshot(entity: T,id: number,modelSingularName: string): Promise<void> {
   const modelMetadataHelperService = this.moduleRef.get(ModelMetadataHelperService, { strict: false });
        const auditRelationFields = (await modelMetadataHelperService.loadFieldHierarchy(modelSingularName)).filter(field =>
            field.enableAuditTracking &&
            field.type === 'relation' &&
            field.relationType !== 'one-to-many'
        );
        if (auditRelationFields.length > 0) {
            const relations: any = {};
            auditRelationFields.forEach(field => relations[field.name] = true);
            const auditBeforeEntity = await this.repo.findOne({
                where: {
                    id: id,
                } as unknown as FindOptionsWhere<T>,
                relations: relations as any,
            });
            if (auditBeforeEntity) {
                Object.defineProperty(entity, AUDIT_BEFORE_SNAPSHOT, {
                    configurable: true,
                    enumerable: false,
                    value: auditBeforeEntity,
                    writable: true,
                });
            }
        }
    }
    //TODO: Will the updates be partial i.e PATCH or full i.e PUT
    async delete(id: number, solidRequestContext: any = {}) {
        if (!id) {
            throw new Error(ERROR_MESSAGES.ID_REQUIRED_FOR_DELETE);
        }
        const loadedmodel = await this.loadModel();
        // Check wheather user has update permission for model
        if (solidRequestContext.activeUser) {
            const hasPermission = this.crudHelperService.hasDeletePermissionOnModel(solidRequestContext.activeUser, loadedmodel.singularName);
            if (!hasPermission) {
                throw new BadRequestException(ERROR_MESSAGES.FORBIDDEN);
            }
        }

        const model = await this.modelMetadataService.findOneBySingularName(this.modelName, {
            fields: {
                model: true,
                mediaStorageProvider: true,
            },
            module: true,
        });
        const entity = await this.repo.findOne({
            where: {
                id: id,
            } as unknown as FindOptionsWhere<T>,
        }
        );
        if (!entity) {
            throw new Error(`Entity [${this.moduleName}.${this.modelName}] with id ${id} not found`);
        }

        let entitiesToDelete: T[] = [entity];
        if (model.draftPublishWorkflow === true) {
            await this.assertDraftPublishDeleteAllowed(entitiesToDelete);
        }

        // If the model has internationalisation enabled, delete children with defaultEntityLocaleId === this entity's id
        if (model.internationalisation) {
            // Find all child entities where defaultEntityLocaleId === this entity's id
            const childEntities = await this.repo.find({
                where: { defaultEntityLocaleId: id } as any
            });

            if (childEntities.length > 0) {
                if (model.enableSoftDelete === true) {
                    await this.repo.softRemove(childEntities);
                } else {
                    await this.repo.remove(childEntities);
                }
            }
        }

        const deletedLatestChainIds = model.draftPublishWorkflow === true
            ? this.getLatestDraftPublishChainIds(entitiesToDelete)
            : [];
        const deletedEntityIds = this.getEntityIds(entitiesToDelete);

        let deleteResult: any;
        if (model.enableSoftDelete === true) {
            this.markDeletedDraftPublishVersionsAsNotLatest(model, entitiesToDelete);
            await this.repo.softRemove(entitiesToDelete);
            deleteResult = await this.repo.save(entitiesToDelete);
        } else {
            deleteResult = await this.repo.remove(entitiesToDelete);
        }

        if (model.draftPublishWorkflow === true) {
            await this.promoteLatestDraftPublishVersionAfterDelete(deletedLatestChainIds, deletedEntityIds);
        }

        return deleteResult;
    }

    private async assertDraftPublishDeleteAllowed(entities: T[]): Promise<void> {
        const ids = entities.map(entity => entity.id).filter(Boolean);
        if (ids.length === 0) return;

        const currentPublishedEntities = await this.repo.find({
            where: {
                id: In(ids),
                isPublished: true,
            } as FindOptionsWhere<T>,
        });

        if (currentPublishedEntities.length > 0) {
            const currentPublishedEntityIds = currentPublishedEntities.map(entity => entity.id);
            throw new BadRequestException(
                `Published ${this.modelName} record cannot be deleted. Publish another draft or unpublish it before deleting. Invalid Ids ${currentPublishedEntityIds.join(', ')}.`
            );
        }
    }

    private markDeletedDraftPublishVersionsAsNotLatest(model: ModelMetadata, entities: T[]): void {
        if (model.draftPublishWorkflow !== true) return;
        for (const entity of entities) {
            if (entity.isLatest === true) {
                entity.isLatest = false;
            }
        }
    }

    private getLatestDraftPublishChainIds(entities: T[]): number[] {
        return Array.from(new Set(
            entities
                .filter(entity => entity.isLatest === true)
                .map(entity => entity.initialEntityVersionId || entity.id)
        ));
    }

    private getEntityIds(entities: T[]): number[] {
        return entities.map(entity => entity.id).filter(Boolean);
    }

    private async promoteLatestDraftPublishVersionAfterDelete(deletedLatestChainIds: number[], deletedIds: number[]): Promise<void> {
        if (deletedLatestChainIds.length === 0) return;

        for (const chainId of deletedLatestChainIds) {
            const replacementQuery = this.repo.manager
                .createQueryBuilder(this.repo.metadata.target, 'entity')
                .where('(entity.initialEntityVersionId = :chainId OR entity.id = :chainId)', { chainId })
                .orderBy('entity.createdAt', 'DESC')
                .addOrderBy('entity.id', 'DESC');

            if (deletedIds.length > 0) {
                replacementQuery.andWhere('entity.id NOT IN (:...deletedIds)', { deletedIds });
            }

            const replacement = await replacementQuery.getOne();
            if (!replacement) continue;

            await this.repo.manager
                .createQueryBuilder()
                .update(this.repo.metadata.target)
                .set({ isLatest: false } as any)
                .where('(initial_entity_version_id = :chainId OR id = :chainId)', { chainId })
                .execute();

            await this.repo.update(replacement.id, { isLatest: true } as unknown as QueryDeepPartialEntity<T>);
        }
    }

    private async fieldCrudManager(fieldMetadata: FieldMetadata, entityManager: EntityManager, isPartialUpdate: boolean = false, isUpdate: boolean = false, entityId?: number) {
        const commonOptions = { required: fieldMetadata.required && !isPartialUpdate, fieldName: fieldMetadata.name, isUpdate };
        switch (fieldMetadata.type) {
            case SolidFieldType.shortText: {
                const options = { ...commonOptions, length: fieldMetadata.max, regexPattern: fieldMetadata.regexPattern };
                return new ShortTextFieldCrudManager(options);
            }
            case SolidFieldType.longtext: {
                const options = { ...commonOptions, regexPattern: fieldMetadata.regexPattern };
                return new LongTextFieldCrudManager(options);
            }
            case SolidFieldType.boolean: {
                const options = { ...commonOptions };
                return new BooleanFieldCrudManager(options);
            }
            case SolidFieldType.richText: {
                const options = { ...commonOptions, regexPattern: fieldMetadata.regexPattern };
                return new RichTextFieldCrudManager(options);
            }
            case SolidFieldType.json: {
                const options = { ...commonOptions };
                return new JsonFieldCrudManager(options);
            }
            case SolidFieldType.int: {
                const options = { ...commonOptions, min: fieldMetadata.min, max: fieldMetadata.max };
                return new IntFieldCrudManager(options);
            }
            case SolidFieldType.decimal: {
                const options = { ...commonOptions, min: fieldMetadata.min, max: fieldMetadata.max };
                return new DecimalFieldCrudManager(options);
            }
            case SolidFieldType.bigint: {
                const options = { ...commonOptions, min: fieldMetadata.min, max: fieldMetadata.max };
                return new BigIntFieldCrudManager(options);
            }
            case SolidFieldType.email: {
                const options = { ...commonOptions, max: fieldMetadata.max ?? MAX_EMAIL_LENGTH, regexPattern: fieldMetadata.regexPattern };
                return new EmailFieldCrudManager(options);
            }
            case SolidFieldType.date:
            case SolidFieldType.datetime: {
                const options = { ...commonOptions };
                return new DateFieldCrudManager(options);
            }
            case SolidFieldType.password: {
                const options = { ...commonOptions, min: fieldMetadata.min, max: fieldMetadata.max, regexPattern: fieldMetadata.regexPattern, hashingService: this.moduleRef.get(HashingService, { strict: false }) };
                return new PasswordFieldCrudManager(options);
            }
            case SolidFieldType.mediaSingle:
            case SolidFieldType.mediaMultiple: {
                // update will need to delete the existing media and save the new media    
                // case 'mediaSingle':
                //    Use the EntityController to extract uploaded content & pass to the entity service.
                //    If embedded media, then the media uri will saved in the entity table,
                //    else the uri will be saved in the media table
                //    Plan the media table schema e.g id, uri, storageProvider, entity_id, entity_name, createdAt, updatedAt
                //     break;
                // case 'mediaMultiple':
                //    Use the EntityController to extract uploaded content & pass to the entity service.
                //    If embedded media, then the media uri will saved in the entity table, else the uri will be saved in the media table
                //    Plan the media table schema e.g id, uri, storageProvider, entity_id, entity_name, createdAt, updatedAt
                const options = {
                    ...commonOptions,
                    mediaMaxSizeKb: fieldMetadata.mediaMaxSizeKb,
                    mediaTypes: fieldMetadata.mediaTypes,
                    type: fieldMetadata.type as unknown as SolidMediaType
                };
                return new MediaFieldCrudManager(options);
            }
            case SolidFieldType.relation: {
                // Identify if the field is for the inverse side or not
                if (fieldMetadata.relationType === RelationType.manyToOne) {
                    const relationCoModelUserKeyFieldName = await this.getUserKeyFieldNameForModel(fieldMetadata.relationCoModelSingularName);
                    const manyToOneOptions: ManyToOneRelationFieldOptions = {
                        ...commonOptions,
                        relationCoModelSingularName: fieldMetadata.relationCoModelSingularName,
                        // modelUserKeyFieldName: fieldMetadata.model.userKeyField?.name,
                        modelSingularName: fieldMetadata.model.singularName,
                        relationCoModelUserKeyFieldName: relationCoModelUserKeyFieldName,
                        entityManager,
                    }
                    return new ManyToOneRelationFieldCrudManager(manyToOneOptions);
                }
                else if (fieldMetadata.relationType === RelationType.oneToMany) {
                    const oneToManyOptions: OneToManyRelationFieldOptions = {
                        ...commonOptions,
                        relationCoModelSingularName: fieldMetadata.relationCoModelSingularName,
                        modelSingularName: fieldMetadata.model.singularName,
                        entityManager,
                        inverseFieldName: fieldMetadata.relationCoModelFieldName,
                        inverseRelationCoModelFieldName: fieldMetadata.name,
                        entityId,
                    }
                    return new OneToManyRelationFieldCrudManager(oneToManyOptions);
                }
                else if (fieldMetadata.relationType === RelationType.manyTomany) {
                    if (fieldMetadata.isRelationManyToManyOwner) {
                        const manyToManyOptions: ManyToManyRelationFieldOptions = {
                            ...commonOptions,
                            relationCoModelSingularName: fieldMetadata.relationCoModelSingularName,
                            modelSingularName: fieldMetadata.model.singularName,
                            isInverseSide: false,
                            entityManager,
                            fieldName: fieldMetadata.name,
                            entityId,
                        }
                        return new ManyToManyRelationFieldCrudManager(manyToManyOptions);
                    }
                    else {
                        const inverseManyToManyOptions: ManyToManyRelationFieldOptions = {
                            ...commonOptions,
                            relationCoModelSingularName: fieldMetadata.relationCoModelSingularName,
                            modelSingularName: fieldMetadata.model.singularName,
                            isInverseSide: true,
                            entityManager,
                            fieldName: fieldMetadata.relationCoModelFieldName,
                            relationCoModelFieldName: fieldMetadata.name,
                            entityId,
                        }
                        return new ManyToManyRelationFieldCrudManager(inverseManyToManyOptions);
                    }
                }
                else throw new Error(ERROR_MESSAGES.RELATION_TYPE_NOT_SUPPORTED);
                // return (fieldMetadata.relationType === 'many-to-one') ? new ManyToOneRelationFieldCrudManager(fieldMetadata, entityManager) : new ManyToManyRelationFieldCrudManager(fieldMetadata, entityManager); //FIXME many-to-many pending
                //    ManyToOne -> fieldId. The value is saved as is. No transformation is required
                //    OneToMany -> fieldIds. Get the value of the oneToMany field side.  No transformation is required (While saving special provision to be made)
                //    ManyToMany
                //     break;
            }
            case SolidFieldType.selectionStatic: {

                //     Validation against the selectionStatic values. No transformation is required
                //     If the value is not in the selectionStatic values, then throw
                //     Also validate against the selectionType
                const options = { ...commonOptions, selectionStaticValues: fieldMetadata.selectionStaticValues, selectionValueType: fieldMetadata.selectionValueType as SelectionValueType, isMultiSelect: fieldMetadata.isMultiSelect };
                return new SelectionStaticFieldCrudManager(options);
            }
            case SolidFieldType.selectionDynamic: {// [HOLD]
                //     Default implementation using list of values.
                //     ISelectionProvider interface to be implemented for dynamic selection
                //     dataSource: string; // The name of the selection provider
                //     filterSchema : json // This is a custom json object that every data source will handle accordingly. We could validate the query against the selection provider
                //     values : string[]; // The values returned by the selection provider
                const options = { ...commonOptions, selectionDynamicProvider: fieldMetadata.selectionDynamicProvider, selectionDynamicProviderCtxt: JSON.parse(fieldMetadata.selectionDynamicProviderCtxt), selectionValueType: fieldMetadata.selectionValueType as SelectionValueType, discoveryService: this.discoveryService, isMultiSelect: fieldMetadata.isMultiSelect };
                return new SelectionDynamicFieldCrudManager(options);
            }
            case SolidFieldType.uuid: {
                const options = { ...commonOptions };
                //    If no value is provided, then generate a uuid. Add to the dto
                return new UUIDFieldCrudManager(options);
            }
            case SolidFieldType.computed: {

                //    The value will be computed by the computed provider
                //    Invoke the appropriate computed provider, get the value and add to the dto
                const options = { ...commonOptions, computedFieldProvider: fieldMetadata.computedFieldValueProvider, computedFieldValueProviderCtxt: fieldMetadata.computedFieldValueProviderCtxt, computedFieldValueType: fieldMetadata.computedFieldValueType as ComputedFieldValueType, discoveryService: this.discoveryService, skipComputation: this.isSkipComputation(isPartialUpdate, fieldMetadata) };
                return new ComputedFieldCrudManager(options);
            }
            default:
                return new NoOpsFieldCrudManager();
        }
    }

    private isSkipComputation(isPartialUpdate: boolean, computedFieldMetadata: FieldMetadata) {
        if (isPartialUpdate) return true; // If it is a partial update, then skip computation
        if (computedFieldMetadata.computedFieldTriggerConfig && computedFieldMetadata.computedFieldTriggerConfig.length > 0) {
            return true; // computedFieldTriggerConfig is a new field introduced as part of the IEntityComputedFieldProvider new interface, so this computation will be skiipped in crud service & will be called in the subscriber instead
        }
        return false; // If it is not a partial update, then do not skip computation
    }

    async find(basicFilterDto: BasicFilterDto, solidRequestContext: any = {}): Promise<any> {
        const alias = 'entity';
        // Extract the required keys from the input query
        let { limit, offset, populateMedia } = basicFilterDto;
        const populateUserIdFields = this.crudHelperService.extractUserIdFieldsFromPopulate(basicFilterDto.populate);

        const { singularName, internationalisation, draftPublishWorkflow } = await this.loadModel();
        // Check wheather user has update permission for model
        if (solidRequestContext.activeUser) {
            const hasPermission = this.crudHelperService.hasReadPermissionOnModel(solidRequestContext.activeUser, singularName);
            if (!hasPermission) {
                throw new BadRequestException('Forbidden');
            }
        }

        // Set the request filter in the request context service
        const requestContextService = this.moduleRef.get(RequestContextService, { strict: false });
        requestContextService.setRequestFilter(basicFilterDto);

        // Create above query on pincode table using query builder
        var qb: SelectQueryBuilder<T> = await this.repo.createSecurityRuleAwareQueryBuilder(alias)

        if (basicFilterDto.groupBy?.length) {
            const groupFilterQb = this.crudHelperService.buildFilterQuery(qb, basicFilterDto, alias, internationalisation, draftPublishWorkflow, this.moduleRef, FilterCombinator.AND, false, false);

            return this.crudHelperService.executeGroupPipeline(
                groupFilterQb, basicFilterDto, alias,
                () => this.repo.createSecurityRuleAwareQueryBuilder(alias),
                async (entities) => {
                    if (populateUserIdFields?.length) await this.handlePopulateUserIdFields(populateUserIdFields, entities);
                    if (populateMedia?.length) await this.handlePopulateMedia(populateMedia, entities);
                }
            );
        }
        else {
            qb = this.crudHelperService.buildFilterQuery(qb, basicFilterDto, alias, internationalisation, draftPublishWorkflow, this.moduleRef);
            const { meta, records } = await this.handleNonGroupFind(qb, populateUserIdFields, populateMedia, offset, limit, alias);
            return {
                meta,
                records,
            }
        }
    }

    private async handleNonGroupFind(qb: SelectQueryBuilder<T>, populateUserIdFields: UserIdFields[], populateMedia: string[], offset: number, limit: number, alias: string) {
        const [entities, count] = await qb.getManyAndCount();

        // Populate the entity with the userId fields
        if (populateUserIdFields && populateUserIdFields.length > 0) {
            await this.handlePopulateUserIdFields(populateUserIdFields, entities);
        }

        // Populate the entity with the media
        if (populateMedia && populateMedia.length > 0) {
            await this.handlePopulateMedia(populateMedia, entities);
        }

        return this.wrapFindResponse(offset, limit, count, entities);
    }

    private wrapFindResponse(offset: number | undefined, limit: number | undefined, count: number, entities: T[]) {
        return this.crudHelperService.pagedResponse(offset, limit, count, entities);
    }

    // entities is an array of T
    // T can contain createdBy and updatedBy fields
    // We need to populate the createdBy and updatedBy fields with the User entity
    private async handlePopulateUserIdFields(userIdFields: UserIdFields[], entities: T[]) {
        const userRepository = this.entityManager.getRepository(User);
        for (const entity of entities) {
            for (const userFieldPath of userIdFields) {
                const userId = entity[userFieldPath as keyof T] as unknown as number;
                if (userId) {
                    const user = await userRepository.findOne({
                        where: { id: userId },
                    });
                    // @ts-ignore
                    entity[userFieldPath] = user;
                }
            }
        }
    }

    private async handlePopulateMedia(populateMedia: string[], entities: T[]) {
        const model = await this.getDatasourceDefaultEntityManager().getRepository(ModelMetadata).findOne({
            where: {
                singularName: this.modelName,
            },
            relations: ['fields', 'fields.mediaStorageProvider', 'fields.model', 'module'],
        });

        // Will iterate through every entity &  all populateMedia & call getMediaDetails for each field
        for (const entity of entities) {
            for (const mediaFieldPath of populateMedia) {
                await this.populateMediaObject(mediaFieldPath, model, entity);
            }
        }
        return entities;
    }

    // Adds the media with full URL to the entity / nested entity
    private async populateMediaObject(mediaFieldPath: string, model: ModelMetadata, entity: T) {
        if (mediaFieldPath.includes('.')) { // mediaFieldPath is a nested field
            const pathParts = mediaFieldPath.split('.');
            const mediaFieldMetadata = await this.getFieldMetadataRecursively(pathParts, model.fields);
            if (!mediaFieldMetadata) {
                throw new BadRequestException(`Media field ${mediaFieldPath} not found in model ${this.modelName}`);
            }

            // We can assume that the media field entity model is already populated as part of the entity data
            const mediaFieldEntities = this.getMediaFieldEntities(entity, pathParts);
            if (!mediaFieldEntities || mediaFieldEntities.length === 0) {
                return;//no need to populate data if relation not exists
            }
            // Populate the media field entities with the full URL
            for (const mediaFieldEntity of mediaFieldEntities) {
                const mediaWithFullUrl = await this.getMediaWithFullUrl(mediaFieldEntity, mediaFieldMetadata);
                this.appendMediaKey(mediaWithFullUrl, mediaFieldEntity, mediaFieldMetadata.name);
                // mediaFieldEntity['_media'][mediaFieldPath] = mediaWithFullUrl
            }
        }
        else {
            // mediaFieldPath is a single field
            const mediaFieldMetadata = model.fields.find(field => field.name === mediaFieldPath);
            if (!mediaFieldMetadata) {
                throw new BadRequestException(`Media field ${mediaFieldPath} not found in model ${this.modelName}`);
            }
            const mediaWithFullUrl = await this.getMediaWithFullUrl(entity, mediaFieldMetadata);
            this.appendMediaKey(mediaWithFullUrl, entity, mediaFieldPath);
            // entity['_media'][mediaFieldPath] = mediaWithFullUrl;
        }
    }

    // // Add the media with full URL to the entity
    private appendMediaKey(mediaWithFullUrl: MediaWithFullUrl[], entity: T, mediaFieldPath: string) {
        // if _media key already exists, append the new media to the existing array
        if (entity['_media']) {
            entity['_media'][mediaFieldPath] = mediaWithFullUrl;
        }
        else {
            entity['_media'] = {
                [mediaFieldPath]: mediaWithFullUrl
            };
        }
    }

    private getMediaFieldEntities(entity: T, mediaPathParts: string[]): T[] {
        let entityPart = entity;
        for (let i = 0; i < mediaPathParts.length - 1; i++) {
            const pathPart = mediaPathParts[i];
            if (entity[pathPart]) {
                entityPart = entity[pathPart];
            } else {
                throw new BadRequestException(`Media field ${pathPart} not found in entity ${JSON.stringify(entity)}`);
            }
        }
        return isArray(entityPart) ? entityPart : [entityPart];
    }

    async getMediaWithFullUrl(mediaEntity: any, mediaFieldMetadata: FieldMetadata): Promise<MediaWithFullUrl[]> {
        const storageProviderMetadata = mediaFieldMetadata.mediaStorageProvider;
        const storageProviderType = storageProviderMetadata.type as MediaStorageProviderType;
        const storageProvider = await getMediaStorageProvider(this.moduleRef, storageProviderType);
        const mediaDetails = await storageProvider.retrieve(mediaEntity, mediaFieldMetadata);
        return mediaDetails as MediaWithFullUrl[];
    }

    async findOne(id: number, query: any = {}, solidRequestContext: any = {}) {
        const { populate = [], fields = [], populateMedia = [] } = query;

        // const normalizedFields = this.crudHelperService.normalize(fields);
        const normalizedPopulate = this.crudHelperService.normalize(populate);
        const normalizedPopulateMedia = this.crudHelperService.normalize(populateMedia);

        // if normalizedPopulateMedia, has any nested media paths, then add then to populate excluding the last part
        const additionalPopulate = this.crudHelperService.additionalRelationsRequiredForMediaPopulation(normalizedPopulateMedia);
        // Add the additional populate relations to the normalizedPopulate, if they are not already present
        normalizedPopulate.push(...additionalPopulate.filter((relation) => !normalizedPopulate.includes(relation)));

        const model = await this.loadModel();
        // Check wheather user has update permission for model
        if (solidRequestContext.activeUser) {
            const hasPermission = this.crudHelperService.hasReadPermissionOnModel(solidRequestContext.activeUser, model.singularName);
            if (!hasPermission) {
                throw new BadRequestException(ERROR_MESSAGES.FORBIDDEN);
            }
        }

        let entity = await this.repo.findOne({
            where: {
                id: id,
            } as unknown as FindOptionsWhere<T>,
            relations: normalizedPopulate,
            select: fields,
        });
        if (!entity) {
            throw new NotFoundException(`Entity [${this.moduleName}.${this.modelName}] with id ${id} not found`);
        }
        // Populate the entity with the media
        if (normalizedPopulateMedia.length > 0) {
            const populatedEntities = await this.handlePopulateMedia(normalizedPopulateMedia, [entity]);
            entity = populatedEntities[0] as Awaited<T>;
        }
        return entity;
    }

    async createMany(createDtos: any[], solidRequestContext: any = {}): Promise<T[]> {
        const loadedmodel = await this.loadModel();

        // Check wheather user has create permission for model
        if (solidRequestContext.activeUser) {
            const hasPermission = this.crudHelperService.hasCreatePermissionOnModel(solidRequestContext.activeUser, loadedmodel.singularName);
            if (!hasPermission) {
                throw new BadRequestException(ERROR_MESSAGES.FORBIDDEN);
            }
        }

        // Fetch model metadata once
        const model = await this.modelMetadataService.findOneBySingularName(this.modelName, {
            fields: {
                model: true,
                mediaStorageProvider: true,
            },
            module: true,
        });

        const entitiesForSave: T[] = [];
        for (const createDto of createDtos) {
            // Validate and transform each createDto sequentially
            let transformedDto = createDto;
            for (const field of model.fields) {
                const fieldManager: FieldCrudManager = await this.fieldCrudManager(field, this.entityManager);
                const validationErrors = await fieldManager.validate(createDto, []); // TODO, This is set, because we are not supporting files for insertMany currently
                if (validationErrors.length > 0) {
                    throw new BadRequestException(`Validation errors in ${field.name} are invalid: ${validationErrors.map(e => e.error).join(', ')}`);
                }
                transformedDto = await fieldManager.transformForCreate(createDto);
            }
            const entity = this.repo.create(transformedDto);
            entitiesForSave.push(entity as unknown as T);
        }
        // Save all entities in a single batch
        const savedEntities = await this.repo.save(entitiesForSave) as T[];
        return savedEntities;
    }

    async insertMany(createDtos: any[], filesArray: Express.Multer.File[][] = [], solidRequestContext: any = {}): Promise<T[]> {
        const savedEntities = await this.createMany(createDtos, solidRequestContext);
        return savedEntities;
    }

    async deleteMany(ids: number[], solidRequestContext: any = {}): Promise<any> {

        if (!ids || ids.length === 0) {
            throw new Error(ERROR_MESSAGES.DELETE_IDS_REQUIRED);
        }

        const loadedmodel = await this.loadModel();
        // Check wheather user has update permission for model
        if (solidRequestContext.activeUser) {
            const hasPermission = this.crudHelperService.hasDeletePermissionOnModel(solidRequestContext.activeUser, loadedmodel.singularName);
            if (!hasPermission) {
                throw new BadRequestException(ERROR_MESSAGES.FORBIDDEN);
            }
        }
        const model = await this.modelMetadataService.findOneBySingularName(this.modelName, {
            fields: {
                model: true,
                mediaStorageProvider: true,
            },
            module: true,
        });



        const removedEntities: T[] = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i]
            const entity = await this.repo.findOne({
                where: {
                    id: id,
                } as unknown as FindOptionsWhere<T>,
            });

            if (!entity) {
                throw new Error(`Entity [${this.moduleName}.${this.modelName}] with id ${id} not found`);
            }

            removedEntities.push(entity);
        }


        // entity-level flag
        const isDraftPublishEnabled = model?.draftPublishWorkflow === true;

        if (isDraftPublishEnabled) {
            await this.assertDraftPublishDeleteAllowed(removedEntities);
        }

        const entitiesToDelete = removedEntities;

        const deletedLatestChainIds = isDraftPublishEnabled
            ? this.getLatestDraftPublishChainIds(entitiesToDelete)
            : [];
        const deletedEntityIds = this.getEntityIds(entitiesToDelete);

        let deleteResult: any;
        if (model.enableSoftDelete === true) {
            this.markDeletedDraftPublishVersionsAsNotLatest(model, entitiesToDelete);
            await this.repo.softRemove(entitiesToDelete);
            deleteResult = await this.repo.save(entitiesToDelete);
        } else {
            deleteResult = await this.repo.remove(entitiesToDelete);
        }

        if (isDraftPublishEnabled) {
            await this.promoteLatestDraftPublishVersionAfterDelete(deletedLatestChainIds, deletedEntityIds);
        }

        return deleteResult;
    }

    async recover(id: number, solidRequestContext: any = {}) {
        try {
            const loadedmodel = await this.loadModel();
            // Check wheather user has update permission for model
            if (solidRequestContext.activeUser) {
                const hasPermission = this.crudHelperService.hasRecoverPermissionOnModel(solidRequestContext.activeUser, loadedmodel.singularName);
                if (!hasPermission) {
                    throw new BadRequestException(ERROR_MESSAGES.FORBIDDEN);
                }
            }

            const softDeletedRows = await this.repo.findOne({
                where: {
                    id, deletedAt: Not(IsNull())
                } as unknown as FindOptionsWhere<T>,
                withDeleted: true,
            });

            if (!softDeletedRows) {
                throw new NotFoundException(ERROR_MESSAGES.NO_SOFT_DELETED_RECORD_FOUND);
            }

            await this.repo.update(id, {
                deletedAt: null, deletedTracker: "not-deleted"
            } as unknown as QueryDeepPartialEntity<T>
            );

            return { message: SUCCESS_MESSAGES.RECORD_RECOVERED, data: softDeletedRows };
        } catch (error: any) {
            if (error instanceof QueryFailedError && (error as any).code === '23505') {
                throw new ConflictException(ERROR_MESSAGES.CONFLICTING_RECORD_ON_UNARCHIVE);
            }
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException(error?.message ?? String(error));
        }
    }

    async recoverMany(ids: number[], solidRequestContext: any = {}) {
        try {
            const loadedmodel = await this.loadModel();
            // Check wheather user has update permission for model
            if (solidRequestContext.activeUser) {
                const hasPermission = this.crudHelperService.hasRecoverPermissionOnModel(solidRequestContext.activeUser, loadedmodel.singularName);
                if (!hasPermission) {
                    throw new BadRequestException(ERROR_MESSAGES.FORBIDDEN);
                }
            }

            if (!ids || ids.length === 0) {
                throw new Error(ERROR_MESSAGES.DELETE_IDS_REQUIRED);
            }

            // Find soft-deleted records matching the given IDs
            const softDeletedRows = await this.repo.find({
                where: {
                    id: In(ids),
                    deletedAt: Not(IsNull()),
                } as unknown as FindOptionsWhere<T>,
                withDeleted: true,
            });

            if (softDeletedRows.length === 0) {
                throw new NotFoundException(ERROR_MESSAGES.NO_SOFT_DELETED_RECORDS_FOUND);
            }

            // Recover the specific records by setting deletedAt to null
            await this.repo.update(
                { id: In(ids) } as unknown as FindOptionsWhere<T>,
                { deletedAt: null, deletedTracker: "not-deleted" } as unknown as QueryDeepPartialEntity<T>
            );

            return { message: SUCCESS_MESSAGES.SELECTED_RECORDS_RECOVERED, recoveredIds: ids };
        } catch (error: any) {
            if (error instanceof QueryFailedError && (error as any).code === "23505") {
                throw new ConflictException(ERROR_MESSAGES.CONFLICTING_RECORD_ON_UNARCHIVE);
            }
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException(error?.message ?? String(error));
        }
    }


    async getFieldMetadataRecursively(pathParts: string[], fields: FieldMetadata[]) {
        if (!pathParts || pathParts.length === 0) {
            throw new BadRequestException(ERROR_MESSAGES.EMPTY_PATH_PARTS);
        }

        const [currentPart, ...remainingParts] = pathParts;
        const field = fields.find(field => field.name === currentPart);

        if (!field) {
            throw new BadRequestException(`Field ${currentPart} not found in model ${this.modelName}`);
        }

        // Base case: last part, return the field
        if (remainingParts.length === 0) {
            return field;
        }

        if (!field.relationCoModelSingularName) {
            throw new BadRequestException(`Field ${field.name} does not define a relationCoModelSingularName`);
        }

        const relationCoModel = await this.getDatasourceDefaultEntityManager().getRepository(ModelMetadata).findOne({
            where: { singularName: field.relationCoModelSingularName },
            relations: ['fields', 'fields.mediaStorageProvider', 'fields.model'],
        });

        if (!relationCoModel) {
            throw new BadRequestException(`Model ${field.relationCoModelSingularName} not found`);
        }

        return this.getFieldMetadataRecursively(remainingParts, relationCoModel.fields);
    }

    async getUserKeyFieldNameForModel(modelSingularName: string): Promise<string> {
        const model = await this.modelMetadataService.findOneBySingularName(modelSingularName, ['userKeyField']);
        if (!model) {
            throw new BadRequestException(`Model ${modelSingularName} not found`);
        }
        return model.userKeyField?.name || '';
    }

    /* Publish a record - marks the selected version as the active published version. */
    async publishRecord(id: number, solidRequestContext: any = {}): Promise<T> {

        const model = await this.loadModel();

        // Check if publish workflow is enabled for this model
        if (!model.draftPublishWorkflow) {
            throw new BadRequestException(
                `Publish workflow is not enabled for ${this.modelName}`
            );
        }

        // Check user permissions
        if (solidRequestContext.activeUser) {
            const hasPermission = this.crudHelperService.hasPublishPermissionOnModel(
                solidRequestContext.activeUser,
                model.singularName
            );
            if (!hasPermission) {
                throw new BadRequestException(ERROR_MESSAGES.FORBIDDEN);
            }
        }

        // Find the entity
        const entity = await this.repo.findOne({ where: { id } as any });
        if (!entity) {
            throw new NotFoundException(`${this.modelName} with id ${id} not found`);
        }

        if (entity.isLatest === false) {
            throw new BadRequestException(`Only the latest version of ${this.modelName} can be published.`);
        }

        // Check if already published
        if (entity.isPublished) {
            throw new BadRequestException(
                `${this.modelName} with id ${id} is already published`
            );
        }

        const chainId = entity.initialEntityVersionId || entity.id;

        const updatedEntity = await this.repo.manager.transaction(async (manager) => {
            const transactionalRepo = manager.getRepository(this.repo.metadata.target);
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
                updatedBy: solidRequestContext.activeUser?.sub ?? entity.updatedBy,
            } as any) as Promise<T>;
        });

        return updatedEntity
    }

    /* Unpublish a record - marks the selected version as not currently published. */
    async unpublishRecord(id: number, solidRequestContext: any = {}): Promise<T> {

        const model = await this.loadModel();

        // Check if publish workflow is enabled for this model
        if (!model.draftPublishWorkflow) {
            throw new BadRequestException(
                `Publish workflow is not enabled for ${this.modelName}`
            );
        }

        // Check user permissions
        if (solidRequestContext.activeUser) {
            const hasPermission = this.crudHelperService.hasUnpublishPermissionOnModel(
                solidRequestContext.activeUser,
                model.singularName
            );
            if (!hasPermission) {
                throw new BadRequestException(ERROR_MESSAGES.FORBIDDEN);
            }
        }

        // Find the entity
        const entity = await this.repo.findOne({ where: { id } as any });
        if (!entity) {
            throw new NotFoundException(`${this.modelName} with id ${id} not found`);
        }

        if (entity.isLatest === false) {
            throw new BadRequestException(`Only the latest version of ${this.modelName} can be unpublished.`);
        }

        // Check if already unpublished
        if (!entity.isPublished) {
            throw new BadRequestException(
                `${this.modelName} with id ${id} is already unpublished`
            );
        }

        // Keep publishedAt as history of when this version was last published.
        const updatedEntity = await this.repo.save({
            ...entity,
            isPublished: false,
            updatedBy: solidRequestContext.activeUser?.sub ?? entity.updatedBy,
        });

        return updatedEntity
    }

    private getDatasourceDefaultEntityManager() {
        return this.defaultDatasourceEntityManager ?? this.entityManager;
    }
}
