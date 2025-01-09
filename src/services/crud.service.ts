import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DiscoveryService } from "@nestjs/core";
import { FileService } from "src/services/file.service";
import { EntityManager, QueryFailedError, SelectQueryBuilder } from "typeorm";
import { Repository } from "typeorm/repository/Repository";
import { BasicFilterDto } from "../dtos/basic-filters.dto";
import { RelationType, SolidFieldType } from "../dtos/create-field-metadata.dto";
import { MediaStorageProviderType } from "../dtos/create-media-storage-provider-metadata.dto";
import { FieldMetadata } from "../entities/field-metadata.entity";
import { ModelMetadata } from "../entities/model-metadata.entity";
import { BigIntFieldCrudManager } from "../helpers/field-crud-managers/BigIntFieldCrudManager";
import { BooleanFieldCrudManager } from "../helpers/field-crud-managers/BooleanFieldCrudManager";
import { ComputedFieldCrudManager } from "../helpers/field-crud-managers/ComputedFieldCrudManager";
import { DateFieldCrudManager } from "../helpers/field-crud-managers/DateFieldCrudManager";
import { DecimalFieldCrudManager } from "../helpers/field-crud-managers/DecimalFieldCrudManager";
import { EmailFieldCrudManager } from "../helpers/field-crud-managers/EmailFieldCrudManager";
import { IntFieldCrudManager } from "../helpers/field-crud-managers/IntFieldCrudManager";
import { JsonFieldCrudManager } from "../helpers/field-crud-managers/JsonFieldCrudManager";
import { LongTextFieldCrudManager } from "../helpers/field-crud-managers/LongTextFieldCrudManager";
import { ManyToManyRelationFieldCrudManager } from "../helpers/field-crud-managers/ManyToManyRelationFieldCrudManager";
import { ManyToOneRelationFieldCrudManager } from "../helpers/field-crud-managers/ManyToOneRelationFieldCrudManager";
import { MediaFieldCrudManager } from "../helpers/field-crud-managers/MediaFieldCrudManager";
import { NoOpsFieldCrudManager } from "../helpers/field-crud-managers/NoOpsFieldCrudManager";
import { OneToManyRelationFieldCrudManager } from "../helpers/field-crud-managers/OneToManyRelationFieldCrudManager";
import { PasswordFieldCrudManager } from "../helpers/field-crud-managers/PasswordFieldCrudManager";
import { RichTextFieldCrudManager } from "../helpers/field-crud-managers/RichTextFieldCrudManager";
import { SelectionDynamicFieldCrudManager } from "../helpers/field-crud-managers/SelectionDynamicFieldCrudManager";
import { SelectionStaticFieldCrudManager } from "../helpers/field-crud-managers/SelectionStaticFieldCrudManager";
import { ShortTextFieldCrudManager } from "../helpers/field-crud-managers/ShortTextFieldCrudManager";
import { UUIDFieldCrudManager } from "../helpers/field-crud-managers/UUIDFieldCrudManager";
import { FieldCrudManager } from "../interfaces";
import { CrudHelperService } from "./crud-helper.service";
import { MediaStorageProviderMetadataService } from "./media-storage-provider-metadata.service";
import { MediaService } from "./media.service";
import { getMediaStorageProvider } from "./mediaStorageProviders";
import { ModelMetadataService } from "./model-metadata.service";
import { ModuleMetadataService } from "./module-metadata.service";

const DEFAULT_LIMIT = 10;
const DEFAULT_OFFSET = 0;
export class CRUDService<T> { //Add two generic value i.e Person,CreatePersonDto, so we get the proper types in our service

    constructor(
        readonly modelMetadataService: ModelMetadataService,
        readonly moduleMetadataService: ModuleMetadataService,
        readonly mediaStorageProviderService: MediaStorageProviderMetadataService,
        readonly configService: ConfigService,
        readonly fileService: FileService,
        readonly mediaService: MediaService,
        readonly discoveryService: DiscoveryService,
        readonly crudHelperService: CrudHelperService,
        readonly entityManager: EntityManager,
        readonly repo: Repository<T>,
        readonly modelName: string,
        readonly moduleName: string,
        //We can just have the Model Entity here
    ) { }

    async create(createDto: any, files: Express.Multer.File[] = []): Promise<T> {
        // This class will be extended by the generated service class i.e PersonService
        // The data required to identify the model and module name will be passed from the generate CrudService subclass
        //TODO: Algorithm to create the entity
        // 1. Fire a query and load all the fields in the provided model name for a particular module
        // FIXME This can be optimized to take in module name i.e (handle scenario wherein same model exists in multiple modules)
        let hasMediaFields = false;

        const model = await this.loadModel();
        const inverseRelationFields = await this.loadInverseRelationFields();
        const fieldsToProcess = [...model.fields, ...inverseRelationFields];

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
            const entity = this.repo.create(createDto);
            const savedEntity = await this.repo.save(entity) as T;

            // 6. Save the media
            if (hasMediaFields) {
                this.saveMedia(model, files, savedEntity);
            }
            return savedEntity;
        } catch (error) {
            if (error instanceof QueryFailedError && error.message.includes('duplicate key value violates unique constraint')) {
                throw new BadRequestException('Duplicate entry. A record with similar unique fields already exists.');
            }
            throw error;
        }
    }

    private async loadInverseRelationFields() {
        const fieldMetadataRepo = this.entityManager.getRepository(FieldMetadata);
        // Since the fields in the dto could be a result of being on a inverse side of a relation, we need to get the field configuration from the inverse side to process it
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

    private async validateAndTransformDto(field: FieldMetadata, dto: any, files: Express.Multer.File[], hasMediaFields: boolean) {
        const fieldManager: FieldCrudManager = this.fieldCrudManager(field, this.entityManager);
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

    //FIXME: Need to make this saving media async. Use queues approach
    private saveMedia(model: ModelMetadata, files: Express.Multer.File[], savedEntity: T) {
        // Get all the media fields in the dto

        const mediaFields = model.fields.filter(field => field.type === 'mediaSingle' || field.type === 'mediaMultiple');

        // Depending upon media storage provider configured, get the appropriate storage provider
        mediaFields.forEach(async (mediaField) => {
            const media = files.filter(multerFile => multerFile.fieldname === mediaField.name);

            // If media is present, then save the media
            if (media.length > 0) {
                const storageProviderMetadata = mediaField.mediaStorageProvider;

                // Use the storage provider metadata to get the appropriate storage provider implementation
                const storageProviderType = storageProviderMetadata.type as MediaStorageProviderType;

                // Get the storage provider implementation
                const storageProvider = getMediaStorageProvider(this.configService, this.fileService, this.mediaService, storageProviderType);

                //Commented the below code since we will be direclty images from server on call from ui 
                // await storageProvider.delete(savedEntity, mediaField);
                await storageProvider.store(media, savedEntity, mediaField);
            }
        });
    }

    //TODO: Will the updates be partial i.e PATCH or full i.e PUT
    async update(id: number, updateDto: any, files: Express.Multer.File[] = []) {
            if (!id) {
            throw new Error('Id is required for update');
        }
        const entity = await this.repo.findOne({
            where: {
                //@ts-ignore
                id: id,
            }
        });
        if (!entity) {
            throw new Error(`Entity [${this.moduleName}.${this.modelName}] with id ${id} not found`);
        }

        updateDto.id = id;
        // This class will be extended by the generated service class i.e PersonService
        // The data required to identify the model and module name will be passed from the generate CrudService subclass
        //TODO: Algorithm to create the entity
        // 1. Fire a query and load all the fields in the provided model name for a particular module
        // FIXME This can be optimized to take in module name i.e (handle scenario wherein same model exists in multiple modules)
        let hasMediaFields = false;

        const model = await this.loadModel();
        const inverseRelationFields = await this.loadInverseRelationFields();
        const fieldsToProcess = [...model.fields, ...inverseRelationFields];

        // 2. Loop through the fields with a switch statement
        // 3. Handle the fields based on field type
        for (const field of fieldsToProcess) {
            const transformed = await this.validateAndTransformDto(field, updateDto, files, hasMediaFields);
            updateDto = transformed.dto;
            hasMediaFields = transformed.hasMediaFields;
        }

        // 5. Save the entity
        // For media, we need to use a storage provider and save the media, then save the associated uri against the entity or media table
        const mergedEntity = this.repo.merge(entity, updateDto);
        const savedEntity = await this.repo.save(mergedEntity) as T;

        // 6. Save the media
        if (hasMediaFields) {
            this.saveMedia(model, files, savedEntity);
        }
        return savedEntity;
    }

    //TODO: Will the updates be partial i.e PATCH or full i.e PUT
    async delete(id: number) {
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
                //@ts-ignore
                id: id,
            }
        });
        if (!entity) {
            throw new Error(`Entity [${this.moduleName}.${this.modelName}] with id ${id} not found`);
        }
        if (model.enableSoftDelete === true) {
            await this.repo.softRemove(entity);
            return this.repo.save(entity);

        } else {
            return this.repo.remove(entity);
        }
    }

    fieldCrudManager(fieldMetadata: FieldMetadata, entityManager: EntityManager): FieldCrudManager {
        switch (fieldMetadata.type) {
            case SolidFieldType.shortText:
                return new ShortTextFieldCrudManager(fieldMetadata);
            case SolidFieldType.longtext:
                return new LongTextFieldCrudManager(fieldMetadata);
            case SolidFieldType.boolean:
                return new BooleanFieldCrudManager(fieldMetadata);
            case SolidFieldType.richText:
                return new RichTextFieldCrudManager(fieldMetadata);
            case SolidFieldType.json:
                return new JsonFieldCrudManager(fieldMetadata);
            case SolidFieldType.int:
                return new IntFieldCrudManager(fieldMetadata);
            case SolidFieldType.decimal:
                return new DecimalFieldCrudManager(fieldMetadata);
            case SolidFieldType.bigint:
                return new BigIntFieldCrudManager(fieldMetadata);
            case SolidFieldType.email:
                return new EmailFieldCrudManager(fieldMetadata);
            case SolidFieldType.date:
            case SolidFieldType.datetime:
                return new DateFieldCrudManager(fieldMetadata);
            // case 'time':
            //     break;
            case SolidFieldType.password:
                return new PasswordFieldCrudManager(fieldMetadata);
            case SolidFieldType.mediaSingle:
            case SolidFieldType.mediaMultiple:
                return new MediaFieldCrudManager(fieldMetadata);
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
            case SolidFieldType.relation:
                // Identify if the field is for the inverse side or not
                const inverseSide = (fieldMetadata.model.singularName !== this.modelName) ? true : false;
                if (fieldMetadata.relationType === RelationType.manyToOne) {
                    return !inverseSide ? new ManyToOneRelationFieldCrudManager(fieldMetadata, entityManager) : new OneToManyRelationFieldCrudManager(fieldMetadata, entityManager, true);
                }
                else if (fieldMetadata.relationType === RelationType.manyTomany) {
                    return !inverseSide ? new ManyToManyRelationFieldCrudManager(fieldMetadata, entityManager, false) : new ManyToManyRelationFieldCrudManager(fieldMetadata, entityManager, true);
                }
                else throw new Error('Relation type not supported in crud service');
            // return (fieldMetadata.relationType === 'many-to-one') ? new ManyToOneRelationFieldCrudManager(fieldMetadata, entityManager) : new ManyToManyRelationFieldCrudManager(fieldMetadata, entityManager); //FIXME many-to-many pending
            //    ManyToOne -> fieldId. The value is saved as is. No transformation is required
            //    OneToMany -> fieldIds. Get the value of the oneToMany field side.  No transformation is required (While saving special provision to be made)
            //    ManyToMany
            //     break;
            case SolidFieldType.selectionStatic:
                //     Validation against the selectionStatic values. No transformation is required
                //     If the value is not in the selectionStatic values, then throw
                //     Also validate against the selectionType
                return new SelectionStaticFieldCrudManager(fieldMetadata);
            case SolidFieldType.selectionDynamic: // [HOLD]
                //     Default implementation using list of values.
                //     ISelectionProvider interface to be implemented for dynamic selection
                //     dataSource: string; // The name of the selection provider
                //     filterSchema : json // This is a custom json object that every data source will handle accordingly. We could validate the query against the selection provider
                //     values : string[]; // The values returned by the selection provider
                return new SelectionDynamicFieldCrudManager(fieldMetadata, this.discoveryService);
            case SolidFieldType.uuid:
                //    If no value is provided, then generate a uuid. Add to the dto
                return new UUIDFieldCrudManager(fieldMetadata);
            case SolidFieldType.computed:
                //    The value will be computed by the computed provider
                //    Invoke the appropriate computed provider, get the value and add to the dto
                return new ComputedFieldCrudManager(fieldMetadata, this.discoveryService);
            default:
                return new NoOpsFieldCrudManager(fieldMetadata);
        }
    }


    async find(basicFilterDto: BasicFilterDto) {
        const alias = 'entity';
        // Extract the required keys from the input query
        let { limit, offset, populateMedia, populateGroup } = basicFilterDto;

        // Create above query on pincode table using query builder
        var qb: SelectQueryBuilder<T> = this.repo.createQueryBuilder(alias)
        qb = this.crudHelperService.buildFilterQuery(qb, basicFilterDto, alias);

        if (basicFilterDto.groupBy) {
            // Get the records and the count
            const { groupMeta, groupRecords } = await this.handleGroupFind(qb, populateGroup, alias, populateMedia);
            return {
                groupMeta,
                groupRecords,
            }
        }
        else {
            // Get the records and the count
            const {meta, records} = await this.handleNonGroupFind(qb, populateMedia, offset, limit);
            return {
                meta,
                records,
            }
        }
    }

    private async handleNonGroupFind(qb: SelectQueryBuilder<T>, populateMedia: string[], offset: number, limit: number) {
        const [entities, count] = await qb.getManyAndCount();

        // Populate the entity with the media
        if (populateMedia && populateMedia.length > 0) {
            await this.handlePopulateMedia(populateMedia, entities);
        }

        return  this.wrapFindResponse(offset, limit, count, entities);
    }

    private async handleGroupFind(qb: SelectQueryBuilder<T>, populateGroup: boolean, alias: string, populateMedia: string[]) {
        const groupByResult = await qb.getRawMany();

        const groupMeta = [];
        const groupRecords = [];
        // For each group, get the records and the count
        for (const group of groupByResult) {
            const groupData = [];
            if (populateGroup) {
                let groupByQb: SelectQueryBuilder<T> = this.repo.createQueryBuilder(alias);
                // For the group by records, apply the basic filter
                const basicFilterDto = {
                    limit: DEFAULT_LIMIT,
                    offset: DEFAULT_OFFSET,
                };
                groupByQb = this.crudHelperService.buildFilterQuery(groupByQb, basicFilterDto, alias);
                groupByQb = this.crudHelperService.buildGroupByRecordsQuery(groupByQb, group, alias);
                const [entities, count] = await groupByQb.getManyAndCount();


                // Populate the entity with the media
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

    private wrapFindResponse(offset: number, limit: number, count: number, entities: T[]) {
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

    private async handlePopulateMedia(populateMedia: string[], entities: T[]) {
        const model = await this.modelMetadataService.findOneBySingularName(this.modelName, {
            fields: {
                model: true,
                mediaStorageProvider: true,
            },
            module: true,
        });

        const mediaFields = model.fields.filter(field => (field.type === 'mediaSingle' || field.type === 'mediaMultiple') && populateMedia.includes(field.name)
        );

        if (mediaFields.length > 0) {
            // Map over all entities and retrieve media in parallel for each entity
            await Promise.all(entities.map(async (entity) => {
                const mediaObj: Record<string, any> = {};
                // Retrieve media for each media field in parallel
                const media = await Promise.all(mediaFields.map(async (mediaField) => {
                    const storageProviderMetadata = mediaField.mediaStorageProvider;
                    const storageProviderType = storageProviderMetadata.type as MediaStorageProviderType;
                    const storageProvider = getMediaStorageProvider(this.configService, this.fileService, this.mediaService, storageProviderType);
                    const mediaResult = await storageProvider.retrieve(entity, mediaField);
                    mediaObj[mediaField.name] = mediaResult;
                }));

                // If media is found, assign to _media field
                if (media.length > 0) {
                    entity['_media'] = mediaObj;
                }
            }));
        }
    }

    async findOne(id: number, query: any) {
        const { populate = [], fields = [], populateMedia = [] } = query;
        const entity = await this.repo.findOne({
            where: {
                //@ts-ignore
                id: id,
            },
            relations: populate,
            select: fields,
        });
        if (!entity) {
            throw new Error(`Entity [${this.moduleName}.${this.modelName}] with id ${id} not found`);
        }
        // Populate the entity with the media
        if (populateMedia.length > 0) {
            const model = await this.modelMetadataService.findOneBySingularName(this.modelName, {
                fields: {
                    model: true,
                    mediaStorageProvider: true,
                },
                module: true,
            });
            const mediaObj: Record<string, any> = {};
            for (const mediaField of model.fields.filter(field => field.type === 'mediaSingle' || field.type === 'mediaMultiple')) {
                if (!populateMedia.includes(mediaField.name)) {
                    continue;
                }
                const storageProviderMetadata = mediaField.mediaStorageProvider;
                const storageProviderType = storageProviderMetadata.type as MediaStorageProviderType;
                const storageProvider = getMediaStorageProvider(this.configService, this.fileService, this.mediaService, storageProviderType);
                const mediaResult = await storageProvider.retrieve(entity, mediaField);
                let obj = { [mediaField.name]: mediaResult }
                mediaObj[mediaField.name] = mediaResult;
                // entity['media'][mediaField.name] = await storageProvider.retrieve(entity, mediaField);
            }
            if (Object.keys(mediaObj).length > 0) {
                entity['_media'] = mediaObj;
            }
        }
        return entity;
    }

    async insertMany(createDtos: any[], filesArray: Express.Multer.File[][] = []): Promise<T[]> {


        // if (createDtos.length !== filesArray.length) {
        //     throw new BadRequestException('Mismatch between data objects and file arrays.');
        // }

        // Fetch model metadata once
        const model = await this.modelMetadataService.findOneBySingularName(this.modelName, {
            fields: {
                model: true,
                mediaStorageProvider: true,
            },
            module: true,
        });

        // Process each createDto in parallel
        const createAndSavePromises = createDtos.map(async (createDto, index) => {
            const files = filesArray[index];
            let hasMediaFields = false;

            // Process each field
            for (const field of model.fields) {
                const fieldManager: FieldCrudManager = this.fieldCrudManager(field, this.entityManager);
                const validationErrors = await fieldManager.validate(createDto, files);
                if (validationErrors.length > 0) {
                    throw new BadRequestException(`Validation errors in ${field.name} are invalid: ${validationErrors.map(e => e.error).join(', ')}`);
                }
                createDto = await fieldManager.transformForCreate(createDto);
                hasMediaFields = hasMediaFields || field.type === 'mediaSingle' || field.type === 'mediaMultiple';
            }

            // Save the entity
            const entity = this.repo.create(createDto);
            const savedEntity = await this.repo.save(entity) as T;

            //Commented since currently Files are not supported for insertmany
            // if (hasMediaFields) {
            //     await this.saveMedia(model, files, savedEntity);
            // }

            return savedEntity;
        });

        // Await all promises in parallel
        const savedEntities = await Promise.all(createAndSavePromises);

        return savedEntities;
    }

    async deleteMany(ids: number[]): Promise<any> {

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
            const id = ids[i]
            const entity = await this.repo.findOne({
                where: {
                    //@ts-ignore
                    id: id,
                }
            });
            removedEntities.push(entity);
        }
        if (model.enableSoftDelete === true) {
            await this.repo.softRemove(removedEntities);
            return this.repo.save(removedEntities);
        } else {
            return this.repo.remove(removedEntities);
        }
        // return removedEntities
    }

}
