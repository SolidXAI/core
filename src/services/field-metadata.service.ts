import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { CascadeType, ComputedFieldValueType, CreateFieldMetadataDto, DecryptWhenType, EncryptionType, MediaType, PSQLType, RelationType, SelectionValueType, SolidFieldType } from '../dtos/create-field-metadata.dto';
import { SelectionDynamicQueryDto } from '../dtos/selection-dynamic-query.dto';
import { UpdateFieldMetaDataDto } from '../dtos/update-field-metadata.dto';
import { FieldMetadata } from '../entities/field-metadata.entity';
import { ModelMetadata } from '../entities/model-metadata.entity';
import { ISelectionProviderValues } from '../interfaces';
import { CrudHelperService } from './crud-helper.service';
import { classify } from '@angular-devkit/core/src/utils/strings';


@Injectable()
export class FieldMetadataService {
    constructor(
        @InjectRepository(FieldMetadata)
        private readonly fieldMetadataRepo: Repository<FieldMetadata>,
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly solidRegistry: SolidRegistry,
        private readonly crudHelperService: CrudHelperService,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    ) { }

    private logger = new Logger(FieldMetadataService.name);

    async updateInverseField(field: FieldMetadata, fieldRepository: Repository<FieldMetadata>, modelRepository: Repository<ModelMetadata>) {
        if (!field.model || !field.model.module) {
            throw new Error('Model and module are required to update inverse field');
        }
        // Update the inverse field in the db
        const savedInverseField = await this.updateInverseFieldInDb(field, fieldRepository, modelRepository);
        // Update the inverse field in the file
        this.updateRelationInverseFieldInFile(savedInverseField, field.relationModelSingularName, field.model.module.name);
    }

    private async updateInverseFieldInDb(field: FieldMetadata, fieldRepository: Repository<FieldMetadata>, modelRepository: Repository<ModelMetadata>): Promise<FieldMetadata> {
        const { moduleName, modelName } = this.validateForInverseField(field);

        // Get the relation model reference
        const relationModel = await this.getRelationModel(modelRepository, field, moduleName);

        // const {id, createdAt, updatedAt, deletedAt, ...fieldKeys} = field;
        switch (field.relationType) {
            case RelationType.manyToOne: {
                const fieldName = field.relationModelFieldName || `${modelName}s`;
                const inverseField: FieldMetadata = {
                    ...field,
                    name: fieldName,
                    displayName: classify(fieldName),
                    description: classify(fieldName),
                    type: SolidFieldType.relation,
                    isSystem: field.isSystem,
                    relationType: RelationType.oneToMany,
                    relationModelSingularName: modelName,
                    relationCreateInverse: true,
                    relationCascade: field.relationCascade,
                    relationModelModuleName: moduleName,
                    relationModelFieldName: field.name,
                    required: false,
                    unique: false,
                    index: false,
                    private: false,
                    encrypt: false,
                    model: relationModel,
                    columnName:null,
                    relationJoinTableName: null,
                    relationJoinColumnName: null,
                    joinColumnName: null,
                    id : null,
                }

                // Load the inverse field, 
                const savedField = await this.saveInverseField(fieldRepository, relationModel, inverseField);
                return savedField;
            }
            case RelationType.oneToMany: {
                const fieldName = field.relationModelFieldName || `${modelName}`;
                const inverseField: FieldMetadata = {
                    ...field,
                    name: fieldName,
                    displayName: classify(fieldName),
                    description: classify(fieldName),
                    type: SolidFieldType.relation,
                    isSystem: field.isSystem,
                    relationType: RelationType.manyToOne,
                    relationModelSingularName: modelName,
                    relationCreateInverse: true,
                    relationCascade: null,
                    relationModelModuleName: moduleName,
                    relationModelFieldName: field.name,
                    required: false,
                    unique: false,
                    index: false,
                    private: false,
                    encrypt: false,
                    model: relationModel,
                    columnName:null,
                    relationJoinTableName: null,
                    relationJoinColumnName: null,
                    joinColumnName: null,
                    id : null,
                }

                // Load the inverse field, 
                const savedField = await this.saveInverseField(fieldRepository, relationModel, inverseField);
                return savedField;
            }
            case RelationType.manyTomany: {
                const fieldName = field.relationModelFieldName;
                // Logic to create a manyToMany inverse field definition
                const inverseFieldManyToMany: FieldMetadata = {
                    ...field,
                    name: fieldName,
                    displayName: classify(fieldName),
                    description: classify(fieldName),
                    type: SolidFieldType.relation,
                    isSystem: field.isSystem,
                    relationType: RelationType.manyTomany,
                    relationModelSingularName: modelName,
                    relationCreateInverse: true,
                    relationCascade: null,
                    relationModelModuleName: moduleName,
                    relationModelFieldName: field.name,
                    required: false,
                    unique: false,
                    index: false,
                    private: false,
                    encrypt: false,
                    model: relationModel,
                    columnName:null,
                    relationJoinTableName: null,
                    relationJoinColumnName: null,
                    joinColumnName: null,
                    isRelationManyToManyOwner: false,
                    id : null,
                }
                const savedField = await this.saveInverseField(fieldRepository, relationModel, inverseFieldManyToMany);
                return savedField;
            }
            default:
                throw new Error(`Invalid relation type for field ${field.name} with relation type  ${field.relationType}`);
        }
    }
    
    private async getRelationModel(modelRepository: Repository<ModelMetadata>, field: FieldMetadata, moduleName: string) {
        return await modelRepository.findOne({
            where: {
                singularName: field.relationModelSingularName,
                module: {
                    name: field.relationModelModuleName ?? moduleName
                }
            }
        });
    }

    private async saveInverseField(fieldRepository: Repository<FieldMetadata>, relationModel: ModelMetadata, inverseField: FieldMetadata): Promise<FieldMetadata> {
        const existingInverseField = await fieldRepository.findOne({
            where: {
                model: relationModel,
                name: inverseField.name
            }
        });

        if (existingInverseField) {
            const updatedField = fieldRepository.merge(existingInverseField, inverseField);
            const savedField = await fieldRepository.save(updatedField);
            return savedField;
        }
        else {
            const savedField = await fieldRepository.save(fieldRepository.create(inverseField));
            return savedField;
        }
    }

    private validateForInverseField(field: FieldMetadata) {
        if (field.type !== SolidFieldType.relation) {
            throw new Error('Only relation fields can have inverse fields');
        }
        const modelName = field.model.singularName;
        const moduleName = field.model.module.name;

        if (!modelName || !moduleName) {
            throw new Error('Model name and module name are required to create inverse field');
        }
        return { moduleName, modelName };
    }

    async findMany(basicFilterDto: BasicFilterDto) {
        const alias = 'fieldMetadata';
        // Extract the required keys from the input query
        let { limit, offset, populateMedia } = basicFilterDto;

        // Create above query on pincode table using query builder
        var qb: SelectQueryBuilder<FieldMetadata> = this.fieldMetadataRepo.createQueryBuilder(alias)
        qb = await this.crudHelperService.buildFilterQuery(qb, basicFilterDto, alias);

        // Get the records and the count
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
        return r
    }

    async findOne(id: any, query?: any) {
        // const { fields, filters, populate } = basicFilterDto;
        const entity = await this.fieldMetadataRepo.findOne({
            where: {
                id: id,
            },
            relations: query && query?.populate,
        });
        if (!entity) {
            throw new NotFoundException(`entity #${id} not found`);
        }
        return entity;
    }

    async findByNameAndModelName(modelSingularName: string, fieldName: string) {

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

    async selectionStaticValues(modelSingularName: string, fieldName: string) {

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

    convertToSelectionProviderValues(selectionStaticValues: string[]): ISelectionProviderValues[] {
        // return selectionStaticValues.split(',').map((item) => {
        //     const [value, label] = item.split(':');
        //     return { label, value };
        // });
        return selectionStaticValues.map((item) => {
            const [value, label] = item.split(':');
            return { label, value };
        });
    }

    async create(createDto: CreateFieldMetadataDto) {
        createDto['model'] = await this.dataSource.getRepository(ModelMetadata).findOne({
            where: {
                id: createDto['modelId']
            },
        });
        createDto['mediaStorageProvider'] = await this.dataSource.getRepository(ModelMetadata).findOne({
            where: {
                id: createDto['mediaStorageProviderId']
            },
        });

        const moduleMetadata = this.fieldMetadataRepo.create(createDto);
        return this.fieldMetadataRepo.save(moduleMetadata);
    }

    // async update(id: number, updateCountryDto: UpdateCountryDto) {

    //     const country = await this.fieldMetadataRepo.preload({
    //         id,
    //         ...updateCountryDto,
    //     });

    //     if (!country) {
    //         throw new NotFoundException(`Country ${id} not found`);
    //     }
    //     return this.moduleMetadataRepo.save(country);
    // }

    async remove(id: number) {
        const entity = await this.findOne(id);
        return this.fieldMetadataRepo.remove(entity);
    }

    async findFieldDefaultMetaData() {

        // Function to convert enum to array of objects
        const enumToResponseArray = (enumObj: any) => {
            return Object.entries(enumObj).map(([key, value]) => ({
                label: value,
                value: value,
            }));
        };

        // Orm Data type and Solid Dat Type Mapping
        const ormFieldTypeForSolid = {
            "postgres": {
                // Numeric types
                "int": {
                    "ormTypes": [{ label: PSQLType.integer, description: "A 4-byte integer for general numeric data." }]
                },
                "bigint": {
                    "ormTypes": [{ label: PSQLType.bigint, description: "An 8-byte integer for large numeric values." }]
                },
                "decimal": {
                    "ormTypes": [{ label: PSQLType.decimal, description: "A high-precision numeric type, ideal for financial data." }]
                },

                // Text types
                "shortText": {
                    "ormTypes": [{ label: PSQLType.varchar, description: "A variable-length string for short text." }]
                },
                "longText": {
                    "ormTypes": [{ label: PSQLType.text, description: "A text type for large or unbounded strings." }]
                },
                "richText": {
                    "ormTypes": [{ label: PSQLType.text, description: "A text type for large or formatted content." }]
                },
                "json": {
                    "ormTypes": [
                        { label: PSQLType.json, description: "Stores JSON data without indexing." },
                        { label: PSQLType.jsonb, description: "Stores JSON data with indexing for faster queries." }
                    ]
                },

                // Boolean types
                "boolean": {
                    "ormTypes": [{ label: PSQLType.boolean, description: "Stores true or false values." }]
                },

                // Date and time types
                "date": {
                    "ormTypes": [{ label: PSQLType.date, description: "Stores calendar dates (YYYY-MM-DD)." }]
                },
                "datetime": {
                    "ormTypes": [
                        { label: PSQLType.timestamp, description: "Stores date and time without time zones." },
                        { label: PSQLType.timestamptz, description: "Stores date and time with time zones." }
                    ]
                },
                "time": {
                    "ormTypes": [
                        { label: PSQLType.time, description: "Stores time values (HH:MM:SS)." },
                        { label: PSQLType.timestamp, description: "Stores date and time without time zones." },
                        { label: PSQLType.timestamptz, description: "Stores date and time with time zones." }
                    ]
                },

                // Relation
                "relation": {
                    "ormTypes": [{ label: PSQLType.integer, description: "Used for foreign keys referencing other entities." }]
                },

                // Media types
                "mediaSingle": {
                    "ormTypes": [{ label: PSQLType.varchar, description: "Stores file paths or URLs for single media files." }]
                },
                "mediaMultiple": {
                    "ormTypes": [{ label: PSQLType.varchar, description: "Stores file paths or URLs for multiple media files." }]
                },

                // Email and password
                "email": {
                    "ormTypes": [{ label: PSQLType.varchar, description: "Stores email addresses." }]
                },
                "password": {
                    "ormTypes": [{ label: PSQLType.varchar, description: "Stores hashed or plain-text passwords." }]
                },

                // Selection types
                "selectionStatic": {
                    "ormTypes": [{ label: PSQLType.varchar, description: "Used for predefined selection options." }]
                },
                "selectionDynamic": {
                    "ormTypes": [{ label: PSQLType.varchar, description: "Used for dynamic selection options." }]
                },

                // Computed and external ID
                "computed": {
                    "ormTypes": [{ label: PSQLType.varchar, description: "Represents computed or derived fields." }]
                },
                "uuid": {
                    "ormTypes": [{ label: PSQLType.varchar, description: "Stores universally unique identifiers (UUIDs)." }]
                }
            }
        };


        // Fetch Data Source Type 
        const dataSourceTypes = Object.keys(ormFieldTypeForSolid); // ["psql"]

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
            }
        });

        // Creating response arrays for each enum
        // Get all selection providers. 
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
            // Field Types with ormtypes, available fields  
            fieldTypes: fieldTypes,
            encryptionTypes: enumToResponseArray(EncryptionType),
            ormType: ormFieldTypeForSolid,
            decryptWhenTypes: enumToResponseArray(DecryptWhenType),
            mediaTypes: enumToResponseArray(MediaType),
            relationTypes: enumToResponseArray(RelationType),
            selectionDynamicProviders: sps,
            computedProviders: cps,
            cascadeTypes: enumToResponseArray(CascadeType),
            selectionValueTypes: enumToResponseArray(SelectionValueType),
            computedFieldValueTypes: enumToResponseArray(ComputedFieldValueType),
            dataSourceType: dataSourceTypes,
            dataSource: dataSource,
        };

        return r
    }

    async fetchCurrentFieldsBasedOnType(type: string) {
        return this.fetchCurrentFields(type);
    }

    private fetchCurrentFields(solidFieldType: string) {
        switch (solidFieldType) {
            case SolidFieldType.int:
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

            case SolidFieldType.bigint:
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

            // case SolidFieldType.float:
            //     return [
            //         "name",
            //         "displayName",
            // "description",
            //         "type",
            //         "ormType",
            //         "isSystem",
            //         "defaultValue",
            //         "required",
            //         "unique",
            //         "index",
            //         "private",
            //         "encrypt",
            //         "encryptionType",
            //         "decryptWhen"
            //     ];

            case SolidFieldType.decimal:
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

            case SolidFieldType.shortText:
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
                    "isUserKey"
                ];

            case SolidFieldType.longtext:
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

            case SolidFieldType.richText:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    // "min",
                    // "max",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];


            case SolidFieldType.json:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    // "min",
                    // "max",
                    "required",
                    "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];

            case SolidFieldType.boolean:
                return [
                    "name",
                    "displayName",
                    "description",
                    "type",
                    "ormType",
                    "isSystem",
                    "defaultValue",
                    // "required",
                    // "unique",
                    "index",
                    "private",
                    "encrypt",
                    "encryptionType",
                    "decryptWhen",
                    "columnName"
                ];

            case SolidFieldType.date:
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

            case SolidFieldType.datetime:
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

            case SolidFieldType.time:
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

            case SolidFieldType.relation:
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
                    "columnName",
                    "relationJoinColumnName",
                    "joinColumnName",
                    "relationJoinTableName",
                    "isRelationManyToManyOwner",
                ];

            case SolidFieldType.mediaSingle:
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

            case SolidFieldType.mediaMultiple:
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

            case SolidFieldType.email:
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

            case SolidFieldType.password:
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

            case SolidFieldType.selectionStatic:
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

            case SolidFieldType.selectionDynamic:
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
            case SolidFieldType.computed:
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

            case SolidFieldType.uuid:
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
        // Initialize the data source
        // await AppDataSource.initialize();

        // // Get all entities metadata
        // const entities = AppDataSource.entityMetadatas;

        // // Create an array to hold the data sources
        // const dataSources = entities.map(entity => ({
        //     name: entity.name,
        //     tableName: entity.tableName,
        //     columns: entity.columns.map(column => ({
        //         propertyName: column.propertyName,
        //         databaseName: column.databaseName,
        //         type: column.type,
        //     })),
        // }));

        // return dataSources;
    }

    async upsert(updateDto: UpdateFieldMetaDataDto) {
        // First check if module already exists using name
        const existingFieldMetadata = await this.fieldMetadataRepo.findOne({
            where: {
                //@ts-ignore
                model: { id: updateDto.model.id },
                name: updateDto.name
            }
        })

        // if found
        if (existingFieldMetadata) {
            const updatedFieldMetadata = { ...existingFieldMetadata, ...updateDto };
            return this.fieldMetadataRepo.save(updatedFieldMetadata);
        }
        // if not found - create new 
        else {
            const fieldMetadata = this.fieldMetadataRepo.create(updateDto);
            return this.fieldMetadataRepo.save(fieldMetadata);
        }
    }

    async getSelectionDynamicValues(query: SelectionDynamicQueryDto) {
        // 1. use the id to identify the field. 
        const entity = await this.fieldMetadataRepo.findOne({
            where: {
                id: query.fieldId,
            },
        });
        if (!entity) {
            throw new NotFoundException(`No field with id #${query.fieldId} exists`);
        }

        // 2. use the field metadata to identify the provider. 
        const selectionDynamicProvider = entity.selectionDynamicProvider;
        const selectionDynamicProviderCtxt = JSON.parse(entity.selectionDynamicProviderCtxt ? entity.selectionDynamicProviderCtxt : '{}');
        selectionDynamicProviderCtxt['limit'] = query.limit;
        selectionDynamicProviderCtxt['offset'] = query.offset;

        // 3. get hold of the provider instance from the SolidRegistry
        const selectionProviderInstance = this.solidRegistry.getSelectionProviderInstance(selectionDynamicProvider);
        if (!selectionProviderInstance) {
            throw new NotFoundException(`Field incorrectly configured. No provider with name ${selectionDynamicProvider} registered in backend.`);
        }

        // 4. use the provider to fetch the dynamic values, pass the query string received from the UI.. 
        return selectionProviderInstance.values(query.query, selectionDynamicProviderCtxt);
    }

    async getSelectionDynamicValue(query: SelectionDynamicQueryDto) {
        // 1. use the id to identify the field. 
        const entity = await this.fieldMetadataRepo.findOne({
            where: {
                id: query.fieldId,
            },
        });
        if (!entity) {
            throw new NotFoundException(`No field with id #${query.fieldId} exists`);
        }

        // 2. use the field metadata to identify the provider. 
        const selectionDynamicProvider = entity.selectionDynamicProvider;
        const selectionDynamicProviderCtxt = JSON.parse(entity.selectionDynamicProviderCtxt ? entity.selectionDynamicProviderCtxt : '{}');
        selectionDynamicProviderCtxt['limit'] = query.limit;
        selectionDynamicProviderCtxt['offset'] = query.offset;

        // 3. get hold of the provider instance from the SolidRegistry
        const selectionProviderInstance = this.solidRegistry.getSelectionProviderInstance(selectionDynamicProvider);
        if (!selectionProviderInstance) {
            throw new NotFoundException(`Field incorrectly configured. No provider with name ${selectionDynamicProvider} registered in backend.`);
        }

        // 4. use the provider to fetch the dynamic values, pass the query string received from the UI.. 
        return selectionProviderInstance.value(query.optionValue, selectionDynamicProviderCtxt);
    }

    private async updateRelationInverseFieldInFile(savedInverseField: FieldMetadata, inverseModelName: string, moduleName: string) {
        try {
            const filePath = this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
            const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);

            // Create the config object for the inverse field
            const fieldObject: Record<string, any> = await this.createFieldConfig(savedInverseField);

            // Find the field config object in the json file
            const model = metaData.moduleMetadata.models.find((model: any) => model.singularName === inverseModelName);

            // Replace the current field object with the above field object
            const fieldIndex = model.fields.findIndex((field: any) => field.name === savedInverseField.name);
            if (fieldIndex === -1) {
                model.fields.push(fieldObject);
            }
            else {
                model.fields[fieldIndex] = fieldObject;
            }

            // Write the updated object back to the file
            const updatedContent = JSON.stringify(metaData, null, 2);
            await fs.writeFile(filePath, updatedContent);
        } catch (error) {
            this.logger.error('File creation failed:', error);
            throw new Error('File creation failed, rolling back transaction'); // Trigger rollback
        }
    }

    //Moved existing reusable logic to a separate function
    async createFieldConfig(field: FieldMetadata) {
        const fieldsRequiredBasedOnType = await this.fetchCurrentFieldsBasedOnType(field.type);
        const fieldObject: Record<string, any> = {};

        // Assign default or placeholder values for required fields
        fieldsRequiredBasedOnType.forEach((requiredField) => {
            fieldObject[requiredField] = field[requiredField];
        });
        
        if (field.type == "mediaSingle" || field.type == "mediaMultiple") {
            if (field.mediaStorageProvider) {
                delete fieldObject.mediaStorageProviderId
                fieldObject.mediaStorageProviderUserKey = field.mediaStorageProvider.name
            }
        }

        return fieldObject;
    }
}


