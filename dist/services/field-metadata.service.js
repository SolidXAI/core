"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldMetadataService = void 0;
const common_1 = require("@nestjs/common");
const field_metadata_entity_1 = require("../entities/field-metadata.entity");
const typeorm_1 = require("typeorm");
const typeorm_2 = require("@nestjs/typeorm");
const create_field_metadata_dto_1 = require("../dtos/create-field-metadata.dto");
const model_metadata_entity_1 = require("../entities/model-metadata.entity");
const create_field_metadata_dto_2 = require("../dtos/create-field-metadata.dto");
const solid_registry_1 = require("../helpers/solid-registry");
const crud_helper_service_1 = require("./crud-helper.service");
let FieldMetadataService = class FieldMetadataService {
    constructor(fieldMetadataRepo, dataSource, solidRegistry, crudHelperService) {
        this.fieldMetadataRepo = fieldMetadataRepo;
        this.dataSource = dataSource;
        this.solidRegistry = solidRegistry;
        this.crudHelperService = crudHelperService;
    }
    async findMany(basicFilterDto) {
        const alias = 'fieldMetadata';
        let { limit, offset, populateMedia } = basicFilterDto;
        var qb = this.fieldMetadataRepo.createQueryBuilder(alias);
        qb = await this.crudHelperService.buildFilterQuery(qb, basicFilterDto, alias);
        const [entities, count] = await qb.getManyAndCount();
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
    async findOne(id, query) {
        const entity = await this.fieldMetadataRepo.findOne({
            where: {
                id: id,
            },
            relations: query && query?.populate,
        });
        if (!entity) {
            throw new common_1.NotFoundException(`entity #${id} not found`);
        }
        return entity;
    }
    async findByNameAndModelName(modelSingularName, fieldName) {
        const entity = await this.fieldMetadataRepo.findOne({
            where: {
                name: fieldName,
                model: {
                    singularName: modelSingularName
                }
            },
        });
        return entity;
    }
    async selectionStaticValues(modelSingularName, fieldName) {
        const entity = await this.fieldMetadataRepo.findOne({
            where: {
                name: fieldName,
                model: {
                    singularName: modelSingularName
                }
            },
        });
        if (!entity) {
            return [];
        }
        const selectionStaticValues = entity.selectionStaticValues;
        if (!selectionStaticValues) {
            return [];
        }
        return this.convertToSelectionProviderValues(selectionStaticValues);
    }
    convertToSelectionProviderValues(selectionStaticValues) {
        return selectionStaticValues.map((item) => {
            const [value, label] = item.split(':');
            return { label, value };
        });
    }
    async create(createDto) {
        createDto['model'] = await this.dataSource.getRepository(model_metadata_entity_1.ModelMetadata).findOne({
            where: {
                id: createDto['modelId']
            },
        });
        createDto['mediaStorageProvider'] = await this.dataSource.getRepository(model_metadata_entity_1.ModelMetadata).findOne({
            where: {
                id: createDto['mediaStorageProviderId']
            },
        });
        const moduleMetadata = this.fieldMetadataRepo.create(createDto);
        return this.fieldMetadataRepo.save(moduleMetadata);
    }
    async remove(id) {
        const entity = await this.findOne(id);
        return this.fieldMetadataRepo.remove(entity);
    }
    async findFieldDefaultMetaData() {
        const enumToResponseArray = (enumObj) => {
            return Object.entries(enumObj).map(([key, value]) => ({
                label: value,
                value: value,
            }));
        };
        const ormFieldTypeForSolid = {
            "postgres": {
                "int": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.integer, description: "A 4-byte integer for general numeric data." }]
                },
                "bigint": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.bigint, description: "An 8-byte integer for large numeric values." }]
                },
                "decimal": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.decimal, description: "A high-precision numeric type, ideal for financial data." }]
                },
                "shortText": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.varchar, description: "A variable-length string for short text." }]
                },
                "longText": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.text, description: "A text type for large or unbounded strings." }]
                },
                "richText": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.text, description: "A text type for large or formatted content." }]
                },
                "json": {
                    "ormTypes": [
                        { label: create_field_metadata_dto_1.PSQLType.json, description: "Stores JSON data without indexing." },
                        { label: create_field_metadata_dto_1.PSQLType.jsonb, description: "Stores JSON data with indexing for faster queries." }
                    ]
                },
                "boolean": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.boolean, description: "Stores true or false values." }]
                },
                "date": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.date, description: "Stores calendar dates (YYYY-MM-DD)." }]
                },
                "datetime": {
                    "ormTypes": [
                        { label: create_field_metadata_dto_1.PSQLType.timestamp, description: "Stores date and time without time zones." },
                        { label: create_field_metadata_dto_1.PSQLType.timestamptz, description: "Stores date and time with time zones." }
                    ]
                },
                "time": {
                    "ormTypes": [
                        { label: create_field_metadata_dto_1.PSQLType.time, description: "Stores time values (HH:MM:SS)." },
                        { label: create_field_metadata_dto_1.PSQLType.timestamp, description: "Stores date and time without time zones." },
                        { label: create_field_metadata_dto_1.PSQLType.timestamptz, description: "Stores date and time with time zones." }
                    ]
                },
                "relation": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.integer, description: "Used for foreign keys referencing other entities." }]
                },
                "mediaSingle": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.varchar, description: "Stores file paths or URLs for single media files." }]
                },
                "mediaMultiple": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.varchar, description: "Stores file paths or URLs for multiple media files." }]
                },
                "email": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.varchar, description: "Stores email addresses." }]
                },
                "password": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.varchar, description: "Stores hashed or plain-text passwords." }]
                },
                "selectionStatic": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.varchar, description: "Used for predefined selection options." }]
                },
                "selectionDynamic": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.varchar, description: "Used for dynamic selection options." }]
                },
                "computed": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.varchar, description: "Represents computed or derived fields." }]
                },
                "uuid": {
                    "ormTypes": [{ label: create_field_metadata_dto_1.PSQLType.varchar, description: "Stores universally unique identifiers (UUIDs)." }]
                }
            }
        };
        const dataSourceTypes = Object.keys(ormFieldTypeForSolid);
        const fieldTypes = Object.entries(ormFieldTypeForSolid.postgres).map(([key, value]) => ({
            type: key,
            label: key,
            value: key,
            fieldType: key,
            ormTypes: value.ormTypes,
            fields: this.fetchCurrentFields(key)
        }));
        const dataSource = this.solidRegistry.getSolidDatabaseModules().map((solidDatabaseModule) => {
            return {
                'name': solidDatabaseModule.instance.name(),
                'type': solidDatabaseModule.instance.type()
            };
        });
        const sps = [];
        const selectionProviders = this.solidRegistry.getSelectionProviders();
        for (let i = 0; i < selectionProviders.length; i++) {
            const selectionProvider = selectionProviders[i];
            sps.push({
                provider: selectionProvider.instance.name(),
                help: selectionProvider.instance.help(),
            });
        }
        const cps = [];
        const computedProviders = this.solidRegistry.getComputedFieldProviders();
        for (let i = 0; i < computedProviders.length; i++) {
            const computedProvider = computedProviders[i];
            cps.push({
                provider: computedProvider.instance.name(),
                help: computedProvider.instance.help(),
            });
        }
        const r = {
            fieldTypes: fieldTypes,
            encryptionTypes: enumToResponseArray(create_field_metadata_dto_1.EncryptionType),
            ormType: ormFieldTypeForSolid,
            decryptWhenTypes: enumToResponseArray(create_field_metadata_dto_1.DecryptWhenType),
            mediaTypes: enumToResponseArray(create_field_metadata_dto_1.MediaType),
            relationTypes: enumToResponseArray(create_field_metadata_dto_1.RelationType),
            selectionDynamicProviders: sps,
            computedProviders: cps,
            cascadeTypes: enumToResponseArray(create_field_metadata_dto_1.CascadeType),
            selectionValueTypes: enumToResponseArray(create_field_metadata_dto_1.SelectionValueType),
            computedFieldValueTypes: enumToResponseArray(create_field_metadata_dto_1.ComputedFieldValueType),
            dataSourceType: dataSourceTypes,
            dataSource: dataSource,
        };
        return r;
    }
    async fetchCurrentFieldsBasedOnType(type) {
        return this.fetchCurrentFields(type);
    }
    fetchCurrentFields(solidFieldType) {
        switch (solidFieldType) {
            case create_field_metadata_dto_2.SolidFieldType.int:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "defaultValue",
                    "min",
                    "max",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName",
                ];
            case create_field_metadata_dto_2.SolidFieldType.bigint:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "defaultValue",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.decimal:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "defaultValue",
                    "min",
                    "max",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.shortText:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "defaultValue",
                    "min",
                    "max",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.longtext:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "regexPattern",
                    "regexPatternNotMatchingErrorMsg",
                    "defaultValue",
                    "min",
                    "max",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.richText:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.json:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.boolean:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "defaultValue",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.date:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "defaultValue",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.datetime:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "defaultValue",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.time:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "defaultValue",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.relation:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "relationType",
                    "relationModelFieldName",
                    "relationCreateInverse",
                    "relationModelSingularName",
                    "relationModelModuleName",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.mediaSingle:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "mediaTypes",
                    "mediaMaxSizeKb",
                    "mediaStorageProviderId",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.mediaMultiple:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "mediaTypes",
                    "mediaMaxSizeKb",
                    "mediaStorageProviderId",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.email:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "regexPattern",
                    "regexPatternNotMatchingErrorMsg",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.password:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "min",
                    "max",
                    "regexPattern",
                    "regexPatternNotMatchingErrorMsg",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.selectionStatic:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "defaultValue",
                    "selectionStaticValues",
                    "selectionValueType",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.selectionDynamic:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "selectionDynamicProvider",
                    "selectionDynamicProviderCtxt",
                    "selectionValueType",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.computed:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "computedFieldValueType",
                    "computedFieldValueProvider",
                    "computedFieldValueProviderCtxt",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            case create_field_metadata_dto_2.SolidFieldType.uuid:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "uuid",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
            default:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];
        }
    }
    async fetchAllDataSources() {
    }
    async upsert(updateDto) {
        const existingFieldMetadata = await this.fieldMetadataRepo.findOne({
            where: {
                model: { id: updateDto.model.id },
                name: updateDto.name
            }
        });
        if (existingFieldMetadata) {
            const updatedFieldMetadata = { ...existingFieldMetadata, ...updateDto };
            return this.fieldMetadataRepo.save(updatedFieldMetadata);
        }
        else {
            const fieldMetadata = this.fieldMetadataRepo.create(updateDto);
            return this.fieldMetadataRepo.save(fieldMetadata);
        }
    }
    async getSelectionDynamicValues(query) {
        const entity = await this.fieldMetadataRepo.findOne({
            where: {
                id: query.fieldId,
            },
        });
        if (!entity) {
            throw new common_1.NotFoundException(`No field with id #${query.fieldId} exists`);
        }
        const selectionDynamicProvider = entity.selectionDynamicProvider;
        const selectionDynamicProviderCtxt = JSON.parse(entity.selectionDynamicProviderCtxt ? entity.selectionDynamicProviderCtxt : '{}');
        selectionDynamicProviderCtxt['limit'] = query.limit;
        selectionDynamicProviderCtxt['offset'] = query.offset;
        const selectionProviderInstance = this.solidRegistry.getSelectionProviderInstance(selectionDynamicProvider);
        if (!selectionProviderInstance) {
            throw new common_1.NotFoundException(`Field incorrectly configured. No provider with name ${selectionDynamicProvider} registered in backend.`);
        }
        return selectionProviderInstance.values(query.query, selectionDynamicProviderCtxt);
    }
    async getSelectionDynamicValue(query) {
        const entity = await this.fieldMetadataRepo.findOne({
            where: {
                id: query.fieldId,
            },
        });
        if (!entity) {
            throw new common_1.NotFoundException(`No field with id #${query.fieldId} exists`);
        }
        const selectionDynamicProvider = entity.selectionDynamicProvider;
        const selectionDynamicProviderCtxt = JSON.parse(entity.selectionDynamicProviderCtxt ? entity.selectionDynamicProviderCtxt : '{}');
        selectionDynamicProviderCtxt['limit'] = query.limit;
        selectionDynamicProviderCtxt['offset'] = query.offset;
        const selectionProviderInstance = this.solidRegistry.getSelectionProviderInstance(selectionDynamicProvider);
        if (!selectionProviderInstance) {
            throw new common_1.NotFoundException(`Field incorrectly configured. No provider with name ${selectionDynamicProvider} registered in backend.`);
        }
        return selectionProviderInstance.value(query.optionValue, selectionDynamicProviderCtxt);
    }
};
exports.FieldMetadataService = FieldMetadataService;
exports.FieldMetadataService = FieldMetadataService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_2.InjectRepository)(field_metadata_entity_1.FieldMetadata)),
    __param(1, (0, typeorm_2.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_1.Repository,
        typeorm_1.DataSource,
        solid_registry_1.SolidRegistry,
        crud_helper_service_1.CrudHelperService])
], FieldMetadataService);
//# sourceMappingURL=field-metadata.service.js.map