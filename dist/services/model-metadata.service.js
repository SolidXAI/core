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
exports.ModelMetadataService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const fs = require("fs/promises");
const path = require("path");
const typeorm_2 = require("typeorm");
const model_metadata_entity_1 = require("../entities/model-metadata.entity");
const module_metadata_entity_1 = require("../entities/module-metadata.entity");
const field_metadata_entity_1 = require("../entities/field-metadata.entity");
const schematic_service_1 = require("../helpers/schematic.service");
const crud_helper_service_1 = require("./crud-helper.service");
const field_metadata_service_1 = require("./field-metadata.service");
const media_storage_provider_metadata_service_1 = require("./media-storage-provider-metadata.service");
const view_metadata_entity_1 = require("../entities/view-metadata.entity");
const action_metadata_entity_1 = require("../entities/action-metadata.entity");
const menu_item_metadata_entity_1 = require("../entities/menu-item-metadata.entity");
const role_metadata_service_1 = require("./role-metadata.service");
let ModelMetadataService = class ModelMetadataService {
    constructor(modelMetadataRepo, fieldMetadataRepo, schematicService, dataSource, crudHelperService, mediaStorageProviderMetadataService, fieldMetadataService, roleService) {
        this.modelMetadataRepo = modelMetadataRepo;
        this.fieldMetadataRepo = fieldMetadataRepo;
        this.schematicService = schematicService;
        this.dataSource = dataSource;
        this.crudHelperService = crudHelperService;
        this.mediaStorageProviderMetadataService = mediaStorageProviderMetadataService;
        this.fieldMetadataService = fieldMetadataService;
        this.roleService = roleService;
        this.logger = new common_1.Logger('ModelMetadataService');
    }
    async findMany(basicFilterDto) {
        const alias = 'modelMetadata';
        let { limit, offset } = basicFilterDto;
        var qb = this.modelMetadataRepo.createQueryBuilder(alias);
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
        const entity = await this.modelMetadataRepo.findOne({
            where: {
                id: id,
            },
            relations: query?.populate,
        });
        if (!entity) {
            throw new common_1.NotFoundException(`entity #${id} not found`);
        }
        return entity;
    }
    async findOneBySingularName(singularName, relations = {}) {
        const entity = await this.modelMetadataRepo.findOne({
            where: {
                singularName: singularName,
            },
            relations: relations,
        });
        if (!entity) {
            throw new common_1.NotFoundException(`entity #${singularName} not found`);
        }
        return entity;
    }
    async findOneByUserKey(singularName, relations = {}) {
        const entity = await this.modelMetadataRepo.findOne({
            where: {
                singularName: singularName,
            },
            relations: relations,
        });
        if (!entity) {
            throw new common_1.NotFoundException(`entity #${singularName} not found`);
        }
        return entity;
    }
    async create(createDto) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const model = await this.createInDB(manager, createDto);
                await this.createInFile(model.id, manager.getRepository(model_metadata_entity_1.ModelMetadata));
                return model;
            });
        }
        catch (error) {
            console.error('Transaction failed:', error);
            throw error;
        }
    }
    async update(id, updateModelMetaDataDto) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const model = await this.updateInDb(manager, id, updateModelMetaDataDto);
                await this.updateInFile(model.id, manager.getRepository(model_metadata_entity_1.ModelMetadata));
            });
        }
        catch (error) {
            console.error('Transaction failed:', error);
            throw error;
        }
    }
    async createInDB(manager, createDto) {
        const resolvedModule = await this.dataSource
            .getRepository(module_metadata_entity_1.ModuleMetadata)
            .findOne({
            where: {
                id: createDto['moduleId'],
            },
            relations: {},
        });
        createDto['module'] = resolvedModule;
        const { fields: fieldsMetadata, ...modelMetaDataWithoutFields } = createDto;
        const modelMetadata = this.modelMetadataRepo.create(modelMetaDataWithoutFields);
        let model = await manager.save(modelMetadata);
        let userKeyField = null;
        const listViewLayout = [];
        const formViewLayout = [];
        const userKeyFieldName = createDto.userKeyFieldUserKey;
        for (let k = 0; k < fieldsMetadata.length; k++) {
            const fieldMetadata = fieldsMetadata[k];
            fieldMetadata['model'] = model;
            if (fieldMetadata.mediaStorageProviderId) {
                fieldMetadata['mediaStorageProvider'] = await this.mediaStorageProviderMetadataService.findOne(fieldMetadata.mediaStorageProviderId);
            }
            const fieldMetadataObject = this.fieldMetadataRepo.create(fieldMetadata);
            const affectedField = await manager.save(fieldMetadataObject);
            if (fieldMetadata.name === userKeyFieldName) {
                userKeyField = affectedField;
            }
            listViewLayout.push({ type: "field", attrs: { name: `${affectedField.name}`, label: `${affectedField.displayName}`, sortable: true, filterable: true } });
            formViewLayout.push({ type: "field", attrs: { name: `${affectedField.name}`, label: `${affectedField.displayName}` } });
        }
        if (userKeyField) {
            modelMetaDataWithoutFields['userKeyField'] = userKeyField;
            const updatedModelMetadataDto = this.modelMetadataRepo.create(modelMetaDataWithoutFields);
            model = await manager.save(updatedModelMetadataDto);
        }
        const modelViews = [{
                name: `${model.singularName}-list-view`,
                displayName: `${model.displayName}`,
                type: 'list',
                context: "{}",
                module: resolvedModule,
                model: model,
                layout: JSON.stringify({
                    type: "list",
                    attrs: {
                        pagination: true,
                        pageSizeOptions: [
                            10,
                            25,
                            50
                        ],
                        enableGlobalSearch: true,
                        create: true,
                        edit: true,
                        delete: true
                    },
                    children: listViewLayout
                }, null, 2)
            },
            {
                name: `${model.singularName}-form-view`,
                displayName: `${model.displayName}`,
                type: 'form',
                context: "{}",
                module: model.module,
                model: model,
                layout: JSON.stringify({
                    type: "form",
                    attrs: { name: "form-1", label: `${model.displayName}`, className: "grid" },
                    children: [
                        {
                            type: "sheet",
                            attrs: { name: "sheet-1" },
                            children: [
                                {
                                    type: "row",
                                    attrs: { name: "group-1", label: "", className: "" },
                                    children: [
                                        {
                                            type: "column",
                                            attrs: { name: "group-1", label: "", className: "col-6" },
                                            children: formViewLayout
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }, null, 2)
            }
        ];
        const viewRepo = manager.getRepository(view_metadata_entity_1.ViewMetadata);
        for (let j = 0; j < modelViews.length; j++) {
            const view = modelViews[j];
            const createdView = await viewRepo.create(view);
            await viewRepo.save(createdView);
        }
        const view = await viewRepo.findOneBy({ name: `${model.singularName}-list-view` });
        const action = {
            displayName: `${model.displayName} List View`,
            name: `${model.singularName}-list-view`,
            type: "solid",
            domain: "",
            context: "",
            customComponent: `/admin/address-master/${model.singularName}/all`,
            customIsModal: true,
            serverEndpoint: "",
            view: view,
            module: resolvedModule,
            model: model
        };
        const actionRepo = manager.getRepository(action_metadata_entity_1.ActionMetadata);
        const createdAction = await actionRepo.create(action);
        const newAction = await actionRepo.save(createdAction);
        const adminRole = await this.roleService.findRoleByName('Admin');
        const menu = {
            displayName: `${model.displayName}`,
            name: `${model.singularName}`,
            sequenceNumber: 1,
            action: newAction,
            module: resolvedModule,
            roles: [adminRole],
            parentMenuItemUserKey: ""
        };
        const menuRepo = manager.getRepository(menu_item_metadata_entity_1.MenuItemMetadata);
        const createdMenu = await menuRepo.create(menu);
        await menuRepo.save(createdMenu);
        return model;
    }
    async createInFile(modelId, repo) {
        try {
            const model = await repo.findOne({
                where: {
                    id: modelId,
                },
                relations: ["fields", "module"],
            });
            const folderPath = path.resolve(process.cwd(), 'module-metadata', model.module.name);
            const filePath = path.join(folderPath, `${model.module.name}-metadata.json`);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const metaData = JSON.parse(fileContent);
            const modelMetaData = {
                singularName: model.singularName,
                pluralName: model.pluralName,
                displayName: model.displayName,
                description: model.description,
                dataSource: model.dataSource,
                dataSourceType: model.dataSourceType,
                fields: []
            };
            const listViewLayoutFields = [{ type: "field", attrs: { name: `id`, label: `Id`, sortable: true, filterable: true } }];
            const formViewLayoutFields = [];
            for (let i = 0; i < model.fields.length; i++) {
                const field = model.fields[i];
                if (!field.isSystem) {
                    const fieldsRequiredBasedOnType = await this.fieldMetadataService.fetchCurrentFieldsBasedOnType(field.type);
                    const fieldObject = {};
                    fieldsRequiredBasedOnType.forEach((requiredField) => {
                        fieldObject[requiredField] = field[requiredField];
                    });
                    modelMetaData.fields.push(fieldObject);
                    listViewLayoutFields.push({ type: "field", attrs: { name: `${field.name}`, label: `${field.displayName}`, sortable: true, filterable: true } });
                    formViewLayoutFields.push({ type: "field", attrs: { name: `${field.name}`, label: `${field.displayName}` } });
                }
            }
            const action = {
                displayName: `${model.displayName} List View`,
                name: `${model.singularName}-list-view`,
                type: "solid",
                domain: "",
                context: "",
                customComponent: `/admin/address-master/${model.singularName}/all`,
                customIsModal: true,
                serverEndpoint: "",
                viewUserKey: `${model.singularName}-list-view`,
                moduleUserKey: `${model.module.name}`,
                modelUserKey: `${model.singularName}`
            };
            const menu = {
                displayName: `${model.displayName}`,
                name: `${model.singularName}`,
                sequenceNumber: 1,
                actionUserKey: `${model.singularName}-list-view`,
                moduleUserKey: `${model.module.name}`,
                parentMenuItemUserKey: ""
            };
            const modelListview = {
                name: `${model.singularName}-list-view`,
                displayName: `${model.displayName}`,
                type: "list",
                context: "{}",
                moduleUserKey: `${model.module.name}`,
                modelUserKey: `${model.singularName}`,
                layout: {
                    type: "list",
                    attrs: {
                        pagination: true,
                        pageSizeOptions: [
                            10,
                            25,
                            50
                        ],
                        enableGlobalSearch: true,
                        create: true,
                        edit: true,
                        delete: true
                    },
                    children: listViewLayoutFields
                }
            };
            const modelFormView = {
                name: `${model.singularName}-form-view`,
                displayName: `${model.displayName}`,
                type: "form",
                context: "{}",
                moduleUserKey: `${model.module.name}`,
                modelUserKey: `${model.singularName}`,
                layout: {
                    type: "form",
                    attrs: { name: "form-1", label: `${model.displayName}`, className: "grid" },
                    children: [
                        {
                            type: "sheet",
                            attrs: { name: "sheet-1" },
                            children: [
                                {
                                    type: "row",
                                    attrs: { name: "sheet-1" },
                                    children: [{
                                            type: "column",
                                            attrs: { name: "group-1", label: "", className: "col-6" },
                                            children: formViewLayoutFields
                                        }]
                                },
                            ]
                        }
                    ]
                }
            };
            metaData.moduleMetadata.models.push(modelMetaData);
            metaData.menus.push(menu);
            metaData.actions.push(action);
            metaData.views.push(modelListview);
            metaData.views.push(modelFormView);
            const updatedContent = JSON.stringify(metaData, null, 2);
            await fs.writeFile(filePath, updatedContent);
        }
        catch (error) {
            console.error('File creation failed:', error);
            throw new Error('File creation failed, rolling back transaction');
        }
    }
    async updateInDb(manager, id, updateModelMetaDataDto) {
        const { fields: fieldsMetadata, ...modelMetaDataWithoutFields } = updateModelMetaDataDto;
        const modelRepo = manager.getRepository(model_metadata_entity_1.ModelMetadata);
        const fieldRepo = manager.getRepository(field_metadata_entity_1.FieldMetadata);
        let existingModel = await modelRepo.findOne({
            where: {
                singularName: updateModelMetaDataDto.singularName
            },
            relations: ["fields", "module"],
        });
        if (!existingModel) {
            throw new Error(`Model with singular name "${updateModelMetaDataDto.singularName}" not found.`);
        }
        const updatedModel = modelRepo.merge(existingModel, modelMetaDataWithoutFields);
        await modelRepo.save(updatedModel);
        const existingFields = existingModel.fields || [];
        const existingFieldIds = existingFields.map((field) => field.id);
        const userKeyFieldName = updateModelMetaDataDto.userKeyFieldUserKey;
        let userKeyField = null;
        const fieldsToSave = [];
        const fieldsToDelete = [];
        for (const fieldMetadata of fieldsMetadata) {
            if (fieldMetadata.id) {
                const existingField = existingFields.find((field) => field.id === fieldMetadata.id);
                if (existingField) {
                    if (fieldMetadata.mediaStorageProviderId) {
                        fieldMetadata['mediaStorageProvider'] = await this.mediaStorageProviderMetadataService.findOne(fieldMetadata.mediaStorageProviderId);
                    }
                    Object.assign(existingField, fieldMetadata);
                    fieldsToSave.push(existingField);
                }
            }
            else {
                fieldMetadata['model'] = updatedModel;
                if (fieldMetadata.mediaStorageProviderId) {
                    fieldMetadata['mediaStorageProvider'] = await this.mediaStorageProviderMetadataService.findOne(fieldMetadata.mediaStorageProviderId);
                }
                const createdField = await this.fieldMetadataRepo.create(fieldMetadata);
                fieldsToSave.push(createdField);
            }
            if (fieldMetadata.name === userKeyFieldName) {
                userKeyField = fieldMetadata;
            }
        }
        fieldsToDelete.push(...existingFields.filter((field) => !fieldsMetadata.some((f) => f.id === field.id)));
        if (fieldsToSave.length > 0) {
            await fieldRepo.save(fieldsToSave);
        }
        if (fieldsToDelete.length > 0) {
            fieldsToDelete.forEach(field => { field.isMarkedForRemoval = true; });
            await fieldRepo.save(fieldsToDelete);
        }
        if (userKeyField) {
            updatedModel.userKeyField = userKeyField;
            await modelRepo.save(updatedModel);
        }
        return updatedModel;
    }
    async updateInFile(modelId, repo) {
        try {
            const model = await repo.findOne({
                where: {
                    id: modelId,
                },
                relations: ["fields", "fields.mediaStorageProvider", "module"],
            });
            const folderPath = path.resolve(process.cwd(), 'module-metadata', model.module.name);
            const filePath = path.join(folderPath, `${model.module.name}-metadata.json`);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const metaData = JSON.parse(fileContent);
            const modelMetaData = {
                singularName: model.singularName,
                pluralName: model.pluralName,
                displayName: model.displayName,
                description: model.description,
                dataSource: model.dataSource,
                dataSourceType: model.dataSourceType,
                fields: []
            };
            for (let i = 0; i < model.fields.length; i++) {
                const field = model.fields[i];
                if (!field.isSystem && !field.isMarkedForRemoval) {
                    const fieldsRequiredBasedOnType = await this.fieldMetadataService.fetchCurrentFieldsBasedOnType(field.type);
                    const fieldObject = {};
                    fieldsRequiredBasedOnType.forEach((requiredField) => {
                        fieldObject[requiredField] = field[requiredField];
                    });
                    if (field.type == "mediaSingle" || field.type == "mediaMultiple") {
                        delete fieldObject.mediaStorageProviderId;
                        fieldObject.mediaStorageProviderUserKey = field.mediaStorageProvider.name;
                    }
                    modelMetaData.fields.push(fieldObject);
                }
            }
            const existingModelIndex = metaData.moduleMetadata.models.findIndex((existingModel) => existingModel.singularName === modelMetaData.singularName);
            if (existingModelIndex !== -1) {
                metaData.moduleMetadata.models[existingModelIndex] = modelMetaData;
            }
            else {
                metaData.moduleMetadata.models.push(modelMetaData);
            }
            const updatedContent = JSON.stringify(metaData, null, 2);
            await fs.writeFile(filePath, updatedContent);
        }
        catch (error) {
            console.error('File creation failed:', error);
            throw new Error('File creation failed, rolling back transaction');
        }
    }
    async upsert(updateDto) {
        const existingModelMetadata = await this.modelMetadataRepo.findOne({
            where: {
                singularName: updateDto.singularName
            }
        });
        if (existingModelMetadata) {
            const updatedModelMetadata = { ...existingModelMetadata, ...updateDto };
            const updatedModel = await this.modelMetadataRepo.save(updatedModelMetadata);
            return updatedModel;
        }
        else {
            const modelMetadata = this.modelMetadataRepo.create(updateDto);
            return this.modelMetadataRepo.save(modelMetadata);
        }
    }
    async removeBySingularName(singularName) {
        try {
            const entity = await this.findOneBySingularName(singularName);
            return this.modelMetadataRepo.remove(entity);
        }
        catch (error) {
        }
    }
    async deleteMany(ids) {
        if (!ids || ids.length === 0) {
            throw new Error('At least one ID is required for deletion');
        }
        const removedEntities = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const entity = await this.modelMetadataRepo.findOne({
                where: {
                    id: id,
                }
            });
            removedEntities.push(await this.modelMetadataRepo.remove(entity));
        }
        return removedEntities;
    }
    async remove(id) {
        const entity = await this.findOne(id);
        return this.modelMetadataRepo.remove(entity);
    }
    async generateCode(options) {
        const query = {
            populate: ["module", "fields"]
        };
        const model = options.modelId ? await this.findOne(options.modelId, query) : await this.findOneByUserKey(options.modelUserKey, query.populate);
        options.fieldIdsForRemoval = model.fields.filter((field) => field.isMarkedForRemoval).map((field) => field.id);
        const refreshModelCodeOutput = await this.generateModelCode(options);
        const removeFieldCodeOuput = await this.generateRemoveFieldsCode(options);
        return `${removeFieldCodeOuput} \n ${refreshModelCodeOutput}`;
    }
    async generateRemoveFieldsCode(options) {
        if (!options.modelId && !options.modelUserKey) {
            throw new common_1.BadRequestException('Model ID or Model Name is required for generating code');
        }
        if (!options.fieldIdsForRemoval || options.fieldIdsForRemoval.length === 0) {
            return "";
        }
        const query = {
            populate: ["module", "fields"]
        };
        const model = options.modelId ? await this.findOne(options.modelId, query) : await this.findOneByUserKey(options.modelUserKey, query.populate);
        const fieldsForRemoval = model.fields.filter((field) => options.fieldIdsForRemoval.includes(+field.id));
        const removeOutput = await this.executeRemoveFieldsCommand(model, fieldsForRemoval, options.dryRun);
        fieldsForRemoval.forEach((field) => {
            if (field.isMarkedForRemoval) {
                this.fieldMetadataService.remove(field.id);
            }
        });
        return removeOutput;
    }
    async generateModelCode(options) {
        if (!options.modelId && !options.modelUserKey) {
            throw new common_1.BadRequestException('Model ID or Model Name is required for generating code');
        }
        const query = {
            populate: ["module", "fields"]
        };
        const model = options.modelId ? await this.findOne(options.modelId, query) : await this.findOneByUserKey(options.modelUserKey, query.populate);
        const refreshOuput = await this.executeRefreshModelCommand(model, options.dryRun);
        return `${refreshOuput}`;
    }
    async executeRefreshModelCommand(model, dryRun = false) {
        const fieldsForRefresh = model.fields.filter((field) => !field.isMarkedForRemoval);
        const output = await this.schematicService.executeSchematicCommand(schematic_service_1.REFRESH_MODEL_COMMAND, {
            module: model.module.name,
            model: model.singularName,
            moduleDisplayName: model.module.displayName,
            dataSource: model.dataSource,
            table: model.tableName,
            fields: fieldsForRefresh,
        }, dryRun);
        this.logger.debug(`Schematic output : ${output}`);
        return output;
    }
    async executeRemoveFieldsCommand(model, fieldsForRemoval, dryRun = false) {
        if (!fieldsForRemoval || fieldsForRemoval.length === 0) {
            return "";
        }
        const output = await this.schematicService.executeSchematicCommand(schematic_service_1.REMOVE_FIELDS_COMMAND, {
            module: model.module.name,
            model: model.singularName,
            fields: fieldsForRemoval,
        }, dryRun);
        this.logger.debug(`Schematic output : ${output}`);
        return output;
    }
};
exports.ModelMetadataService = ModelMetadataService;
exports.ModelMetadataService = ModelMetadataService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(model_metadata_entity_1.ModelMetadata)),
    __param(1, (0, typeorm_1.InjectRepository)(field_metadata_entity_1.FieldMetadata)),
    __param(3, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        schematic_service_1.SchematicService,
        typeorm_2.DataSource,
        crud_helper_service_1.CrudHelperService,
        media_storage_provider_metadata_service_1.MediaStorageProviderMetadataService,
        field_metadata_service_1.FieldMetadataService,
        role_metadata_service_1.RoleMetadataService])
], ModelMetadataService);
//# sourceMappingURL=model-metadata.service.js.map