"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRUDService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const create_field_metadata_dto_1 = require("../dtos/create-field-metadata.dto");
const field_metadata_entity_1 = require("../entities/field-metadata.entity");
const BigIntFieldCrudManager_1 = require("../helpers/field-crud-managers/BigIntFieldCrudManager");
const BooleanFieldCrudManager_1 = require("../helpers/field-crud-managers/BooleanFieldCrudManager");
const ComputedFieldCrudManager_1 = require("../helpers/field-crud-managers/ComputedFieldCrudManager");
const DateFieldCrudManager_1 = require("../helpers/field-crud-managers/DateFieldCrudManager");
const DecimalFieldCrudManager_1 = require("../helpers/field-crud-managers/DecimalFieldCrudManager");
const EmailFieldCrudManager_1 = require("../helpers/field-crud-managers/EmailFieldCrudManager");
const IntFieldCrudManager_1 = require("../helpers/field-crud-managers/IntFieldCrudManager");
const JsonFieldCrudManager_1 = require("../helpers/field-crud-managers/JsonFieldCrudManager");
const LongTextFieldCrudManager_1 = require("../helpers/field-crud-managers/LongTextFieldCrudManager");
const ManyToManyRelationFieldCrudManager_1 = require("../helpers/field-crud-managers/ManyToManyRelationFieldCrudManager");
const ManyToOneRelationFieldCrudManager_1 = require("../helpers/field-crud-managers/ManyToOneRelationFieldCrudManager");
const MediaFieldCrudManager_1 = require("../helpers/field-crud-managers/MediaFieldCrudManager");
const NoOpsFieldCrudManager_1 = require("../helpers/field-crud-managers/NoOpsFieldCrudManager");
const OneToManyRelationFieldCrudManager_1 = require("../helpers/field-crud-managers/OneToManyRelationFieldCrudManager");
const PasswordFieldCrudManager_1 = require("../helpers/field-crud-managers/PasswordFieldCrudManager");
const RichTextFieldCrudManager_1 = require("../helpers/field-crud-managers/RichTextFieldCrudManager");
const SelectionDynamicFieldCrudManager_1 = require("../helpers/field-crud-managers/SelectionDynamicFieldCrudManager");
const SelectionStaticFieldCrudManager_1 = require("../helpers/field-crud-managers/SelectionStaticFieldCrudManager");
const ShortTextFieldCrudManager_1 = require("../helpers/field-crud-managers/ShortTextFieldCrudManager");
const UUIDFieldCrudManager_1 = require("../helpers/field-crud-managers/UUIDFieldCrudManager");
const mediaStorageProviders_1 = require("./mediaStorageProviders");
const DEFAULT_LIMIT = 10;
const DEFAULT_OFFSET = 0;
class CRUDService {
    constructor(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, modelName, moduleName) {
        this.modelMetadataService = modelMetadataService;
        this.moduleMetadataService = moduleMetadataService;
        this.mediaStorageProviderService = mediaStorageProviderService;
        this.configService = configService;
        this.fileService = fileService;
        this.mediaService = mediaService;
        this.discoveryService = discoveryService;
        this.crudHelperService = crudHelperService;
        this.entityManager = entityManager;
        this.repo = repo;
        this.modelName = modelName;
        this.moduleName = moduleName;
    }
    async create(createDto, files = []) {
        let hasMediaFields = false;
        const model = await this.loadModel();
        const inverseRelationFields = await this.loadInverseRelationFields();
        const fieldsToProcess = [...model.fields, ...inverseRelationFields];
        for (const field of fieldsToProcess) {
            const transformed = await this.validateAndTransformDto(field, createDto, files, hasMediaFields);
            createDto = transformed.dto;
            hasMediaFields = transformed.hasMediaFields;
        }
        ;
        try {
            const entity = this.repo.create(createDto);
            const savedEntity = await this.repo.save(entity);
            if (hasMediaFields) {
                this.saveMedia(model, files, savedEntity);
            }
            return savedEntity;
        }
        catch (error) {
            if (error instanceof typeorm_1.QueryFailedError && error.message.includes('duplicate key value violates unique constraint')) {
                throw new common_1.BadRequestException('Duplicate entry. A record with similar unique fields already exists.');
            }
            throw error;
        }
    }
    async loadInverseRelationFields() {
        const fieldMetadataRepo = this.entityManager.getRepository(field_metadata_entity_1.FieldMetadata);
        const inverseRelationFields = await fieldMetadataRepo.find({
            where: {
                type: 'relation',
                relationModelSingularName: this.modelName,
                relationCreateInverse: true,
            },
            relations: ['model'],
        });
        return inverseRelationFields;
    }
    async loadModel() {
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
    async validateAndTransformDto(field, dto, files, hasMediaFields) {
        const fieldManager = this.fieldCrudManager(field, this.entityManager);
        const validationErrors = fieldManager.validate(dto, files);
        const errors = (validationErrors instanceof Promise) ? await validationErrors : validationErrors;
        if (errors.length > 0) {
            throw new common_1.BadRequestException(`Validation errors in ${field.name} is invalid i.e ${errors.map(e => e.error).join(', ')}`);
        }
        const dtoOrPromise = fieldManager.transformForCreate(dto);
        dto = (dtoOrPromise instanceof Promise) ? await dtoOrPromise : dtoOrPromise;
        hasMediaFields = hasMediaFields || field.type === 'mediaSingle' || field.type === 'mediaMultiple';
        return { dto, hasMediaFields };
    }
    saveMedia(model, files, savedEntity) {
        const mediaFields = model.fields.filter(field => field.type === 'mediaSingle' || field.type === 'mediaMultiple');
        mediaFields.forEach(async (mediaField) => {
            const media = files.filter(multerFile => multerFile.fieldname === mediaField.name);
            if (media.length > 0) {
                const storageProviderMetadata = mediaField.mediaStorageProvider;
                const storageProviderType = storageProviderMetadata.type;
                const storageProvider = (0, mediaStorageProviders_1.getMediaStorageProvider)(this.configService, this.fileService, this.mediaService, storageProviderType);
                await storageProvider.store(media, savedEntity, mediaField);
            }
        });
    }
    async update(id, updateDto, files = []) {
        if (!id) {
            throw new Error('Id is required for update');
        }
        const entity = await this.repo.findOne({
            where: {
                id: id,
            }
        });
        if (!entity) {
            throw new Error(`Entity [${this.moduleName}.${this.modelName}] with id ${id} not found`);
        }
        updateDto.id = id;
        let hasMediaFields = false;
        const model = await this.loadModel();
        const inverseRelationFields = await this.loadInverseRelationFields();
        const fieldsToProcess = [...model.fields, ...inverseRelationFields];
        for (const field of fieldsToProcess) {
            const transformed = await this.validateAndTransformDto(field, updateDto, files, hasMediaFields);
            updateDto = transformed.dto;
            hasMediaFields = transformed.hasMediaFields;
        }
        const mergedEntity = this.repo.merge(entity, updateDto);
        const savedEntity = await this.repo.save(mergedEntity);
        if (hasMediaFields) {
            this.saveMedia(model, files, savedEntity);
        }
        return savedEntity;
    }
    async delete(id) {
        if (!id) {
            throw new Error('Id is required for update');
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
            }
        });
        if (!entity) {
            throw new Error(`Entity [${this.moduleName}.${this.modelName}] with id ${id} not found`);
        }
        if (model.enableSoftDelete === true) {
            await this.repo.softRemove(entity);
            return this.repo.save(entity);
        }
        else {
            return this.repo.remove(entity);
        }
    }
    fieldCrudManager(fieldMetadata, entityManager) {
        switch (fieldMetadata.type) {
            case create_field_metadata_dto_1.SolidFieldType.shortText:
                return new ShortTextFieldCrudManager_1.ShortTextFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.longtext:
                return new LongTextFieldCrudManager_1.LongTextFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.boolean:
                return new BooleanFieldCrudManager_1.BooleanFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.richText:
                return new RichTextFieldCrudManager_1.RichTextFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.json:
                return new JsonFieldCrudManager_1.JsonFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.int:
                return new IntFieldCrudManager_1.IntFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.decimal:
                return new DecimalFieldCrudManager_1.DecimalFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.bigint:
                return new BigIntFieldCrudManager_1.BigIntFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.email:
                return new EmailFieldCrudManager_1.EmailFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.date:
            case create_field_metadata_dto_1.SolidFieldType.datetime:
                return new DateFieldCrudManager_1.DateFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.password:
                return new PasswordFieldCrudManager_1.PasswordFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.mediaSingle:
            case create_field_metadata_dto_1.SolidFieldType.mediaMultiple:
                return new MediaFieldCrudManager_1.MediaFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.relation:
                const inverseSide = (fieldMetadata.model.singularName !== this.modelName) ? true : false;
                if (fieldMetadata.relationType === create_field_metadata_dto_1.RelationType.manyToOne) {
                    return !inverseSide ? new ManyToOneRelationFieldCrudManager_1.ManyToOneRelationFieldCrudManager(fieldMetadata, entityManager) : new OneToManyRelationFieldCrudManager_1.OneToManyRelationFieldCrudManager(fieldMetadata, entityManager, true);
                }
                else if (fieldMetadata.relationType === create_field_metadata_dto_1.RelationType.manyTomany) {
                    return !inverseSide ? new ManyToManyRelationFieldCrudManager_1.ManyToManyRelationFieldCrudManager(fieldMetadata, entityManager, false) : new ManyToManyRelationFieldCrudManager_1.ManyToManyRelationFieldCrudManager(fieldMetadata, entityManager, true);
                }
                else
                    throw new Error('Relation type not supported in crud service');
            case create_field_metadata_dto_1.SolidFieldType.selectionStatic:
                return new SelectionStaticFieldCrudManager_1.SelectionStaticFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.selectionDynamic:
                return new SelectionDynamicFieldCrudManager_1.SelectionDynamicFieldCrudManager(fieldMetadata, this.discoveryService);
            case create_field_metadata_dto_1.SolidFieldType.uuid:
                return new UUIDFieldCrudManager_1.UUIDFieldCrudManager(fieldMetadata);
            case create_field_metadata_dto_1.SolidFieldType.computed:
                return new ComputedFieldCrudManager_1.ComputedFieldCrudManager(fieldMetadata, this.discoveryService);
            default:
                return new NoOpsFieldCrudManager_1.NoOpsFieldCrudManager(fieldMetadata);
        }
    }
    async find(basicFilterDto) {
        const alias = 'entity';
        let { limit, offset, populateMedia, populateGroup } = basicFilterDto;
        var qb = this.repo.createQueryBuilder(alias);
        qb = this.crudHelperService.buildFilterQuery(qb, basicFilterDto, alias);
        if (basicFilterDto.groupBy) {
            const { groupMeta, groupRecords } = await this.handleGroupFind(qb, populateGroup, alias, populateMedia);
            return {
                groupMeta,
                groupRecords,
            };
        }
        else {
            const { meta, records } = await this.handleNonGroupFind(qb, populateMedia, offset, limit);
            return {
                meta,
                records,
            };
        }
    }
    async handleNonGroupFind(qb, populateMedia, offset, limit) {
        const [entities, count] = await qb.getManyAndCount();
        if (populateMedia && populateMedia.length > 0) {
            await this.handlePopulateMedia(populateMedia, entities);
        }
        return this.wrapFindResponse(offset, limit, count, entities);
    }
    async handleGroupFind(qb, populateGroup, alias, populateMedia) {
        const groupByResult = await qb.getRawMany();
        const groupMeta = [];
        const groupRecords = [];
        for (const group of groupByResult) {
            const groupData = [];
            if (populateGroup) {
                let groupByQb = this.repo.createQueryBuilder(alias);
                const basicFilterDto = {
                    limit: DEFAULT_LIMIT,
                    offset: DEFAULT_OFFSET,
                };
                groupByQb = this.crudHelperService.buildFilterQuery(groupByQb, basicFilterDto, alias);
                groupByQb = this.crudHelperService.buildGroupByRecordsQuery(groupByQb, group, alias);
                const [entities, count] = await groupByQb.getManyAndCount();
                if (populateMedia && populateMedia.length > 0) {
                    await this.handlePopulateMedia(populateMedia, entities);
                }
                groupData.push(this.wrapFindResponse(basicFilterDto.offset, basicFilterDto.limit, count, entities));
                groupRecords.push(this.crudHelperService.createGroupRecords(group, alias, groupData));
            }
            groupMeta.push(this.crudHelperService.createGroupMeta(group, alias));
        }
        return { groupMeta, groupRecords };
    }
    wrapFindResponse(offset, limit, count, entities) {
        const currentPage = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(count / limit);
        const nextPage = currentPage < totalPages ? currentPage + 1 : null;
        const prevPage = currentPage > 1 ? currentPage - 1 : null;
        const r = {
            meta: {
                totalRecords: count,
                currentPage: currentPage,
                nextPage: nextPage,
                prevPage: prevPage,
                totalPages: totalPages,
                perPage: +limit,
            },
            records: entities
        };
        return r;
    }
    async handlePopulateMedia(populateMedia, entities) {
        const model = await this.modelMetadataService.findOneBySingularName(this.modelName, {
            fields: {
                model: true,
                mediaStorageProvider: true,
            },
            module: true,
        });
        const mediaFields = model.fields.filter(field => (field.type === 'mediaSingle' || field.type === 'mediaMultiple') && populateMedia.includes(field.name));
        if (mediaFields.length > 0) {
            await Promise.all(entities.map(async (entity) => {
                const mediaObj = {};
                const media = await Promise.all(mediaFields.map(async (mediaField) => {
                    const storageProviderMetadata = mediaField.mediaStorageProvider;
                    const storageProviderType = storageProviderMetadata.type;
                    const storageProvider = (0, mediaStorageProviders_1.getMediaStorageProvider)(this.configService, this.fileService, this.mediaService, storageProviderType);
                    const mediaResult = await storageProvider.retrieve(entity, mediaField);
                    mediaObj[mediaField.name] = mediaResult;
                }));
                if (media.length > 0) {
                    entity['_media'] = mediaObj;
                }
            }));
        }
    }
    async findOne(id, query) {
        const { populate = [], fields = [], populateMedia = [] } = query;
        const entity = await this.repo.findOne({
            where: {
                id: id,
            },
            relations: populate,
            select: fields,
        });
        if (!entity) {
            throw new Error(`Entity [${this.moduleName}.${this.modelName}] with id ${id} not found`);
        }
        if (populateMedia.length > 0) {
            const model = await this.modelMetadataService.findOneBySingularName(this.modelName, {
                fields: {
                    model: true,
                    mediaStorageProvider: true,
                },
                module: true,
            });
            const mediaObj = {};
            for (const mediaField of model.fields.filter(field => field.type === 'mediaSingle' || field.type === 'mediaMultiple')) {
                if (!populateMedia.includes(mediaField.name)) {
                    continue;
                }
                const storageProviderMetadata = mediaField.mediaStorageProvider;
                const storageProviderType = storageProviderMetadata.type;
                const storageProvider = (0, mediaStorageProviders_1.getMediaStorageProvider)(this.configService, this.fileService, this.mediaService, storageProviderType);
                const mediaResult = await storageProvider.retrieve(entity, mediaField);
                let obj = { [mediaField.name]: mediaResult };
                mediaObj[mediaField.name] = mediaResult;
            }
            if (Object.keys(mediaObj).length > 0) {
                entity['_media'] = mediaObj;
            }
        }
        return entity;
    }
    async insertMany(createDtos, filesArray = []) {
        const model = await this.modelMetadataService.findOneBySingularName(this.modelName, {
            fields: {
                model: true,
                mediaStorageProvider: true,
            },
            module: true,
        });
        const createAndSavePromises = createDtos.map(async (createDto, index) => {
            const files = filesArray[index];
            let hasMediaFields = false;
            for (const field of model.fields) {
                const fieldManager = this.fieldCrudManager(field, this.entityManager);
                const validationErrors = await fieldManager.validate(createDto, files);
                if (validationErrors.length > 0) {
                    throw new common_1.BadRequestException(`Validation errors in ${field.name} are invalid: ${validationErrors.map(e => e.error).join(', ')}`);
                }
                createDto = await fieldManager.transformForCreate(createDto);
                hasMediaFields = hasMediaFields || field.type === 'mediaSingle' || field.type === 'mediaMultiple';
            }
            const entity = this.repo.create(createDto);
            const savedEntity = await this.repo.save(entity);
            return savedEntity;
        });
        const savedEntities = await Promise.all(createAndSavePromises);
        return savedEntities;
    }
    async deleteMany(ids) {
        if (!ids || ids.length === 0) {
            throw new Error('At least one ID is required for deletion');
        }
        const model = await this.modelMetadataService.findOneBySingularName(this.modelName, {
            fields: {
                model: true,
                mediaStorageProvider: true,
            },
            module: true,
        });
        const removedEntities = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const entity = await this.repo.findOne({
                where: {
                    id: id,
                }
            });
            removedEntities.push(entity);
        }
        if (model.enableSoftDelete === true) {
            await this.repo.softRemove(removedEntities);
            return this.repo.save(removedEntities);
        }
        else {
            return this.repo.remove(removedEntities);
        }
    }
}
exports.CRUDService = CRUDService;
//# sourceMappingURL=crud.service.js.map