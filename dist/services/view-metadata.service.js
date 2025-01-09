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
exports.ViewMetadataService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const core_1 = require("@nestjs/core");
const typeorm_2 = require("typeorm");
const crud_service_1 = require("./crud.service");
const model_metadata_service_1 = require("./model-metadata.service");
const module_metadata_service_1 = require("./module-metadata.service");
const media_storage_provider_metadata_service_1 = require("./media-storage-provider-metadata.service");
const config_1 = require("@nestjs/config");
const media_service_1 = require("./media.service");
const file_service_1 = require("./file.service");
const crud_helper_service_1 = require("./crud-helper.service");
const view_metadata_entity_1 = require("../entities/view-metadata.entity");
const field_metadata_entity_1 = require("../entities/field-metadata.entity");
const model_metadata_entity_1 = require("../entities/model-metadata.entity");
const action_metadata_service_1 = require("./action-metadata.service");
let ViewMetadataService = class ViewMetadataService extends crud_service_1.CRUDService {
    constructor(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, actionMetadataService, entityManager, repo, fieldMetadataRepo, modelMetadataRepo) {
        super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, 'viewMetadata', 'app-builder');
        this.modelMetadataService = modelMetadataService;
        this.moduleMetadataService = moduleMetadataService;
        this.mediaStorageProviderService = mediaStorageProviderService;
        this.configService = configService;
        this.fileService = fileService;
        this.mediaService = mediaService;
        this.discoveryService = discoveryService;
        this.crudHelperService = crudHelperService;
        this.actionMetadataService = actionMetadataService;
        this.entityManager = entityManager;
        this.repo = repo;
        this.fieldMetadataRepo = fieldMetadataRepo;
        this.modelMetadataRepo = modelMetadataRepo;
    }
    async getLayout(query) {
        let { modelName, moduleName, viewType, populate } = query;
        const entity = await this.repo.findOne({
            where: {
                model: { singularName: modelName },
                module: { name: moduleName },
                type: viewType,
            },
            relations: {
                model: true,
                module: true
            },
        });
        if (entity) {
            entity.layout = JSON.parse(entity.layout);
            if (entity.layout.attrs.createAction) {
                const actionName = entity.layout.attrs.createAction;
                entity.layout.attrs.createAction = await this.actionMetadataService.findOneByUserKey(actionName);
            }
            if (entity.layout.attrs.editAction) {
                const actionName = entity.layout.attrs.editAction;
                entity.layout.attrs.editAction = await this.actionMetadataService.findOneByUserKey(actionName);
            }
        }
        const fields = await this.fieldMetadataRepo.find({
            where: {
                model: {
                    singularName: modelName,
                }
            }
        });
        const fieldsMap = new Map();
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            if (field.type === 'relation') {
                const relationModel = await this.modelMetadataRepo.find({
                    where: {
                        singularName: field.relationModelSingularName
                    },
                    relations: {
                        userKeyField: true
                    }
                });
                if (relationModel) {
                    field['relationModel'] = relationModel[0];
                }
            }
            if (!fieldsMap.has(field.name)) {
                fieldsMap.set(field.name, field);
            }
        }
        return {
            'solidView': entity,
            'solidFieldsMetadata': Object.fromEntries(fieldsMap),
        };
    }
    async findOneByUserKey(name, relations = {}) {
        const entity = await this.repo.findOne({
            where: {
                name: name,
            },
            relations: relations,
        });
        return entity;
    }
    async upsert(updateSolidViewDto) {
        const existingSolidView = await this.findOneByUserKey(updateSolidViewDto.name);
        if (existingSolidView) {
            const updatedSolidViewDto = { ...existingSolidView, ...updateSolidViewDto };
            return this.repo.save(updatedSolidViewDto);
        }
        else {
            const viewData = this.repo.create(updateSolidViewDto);
            return this.repo.save(viewData);
        }
    }
};
exports.ViewMetadataService = ViewMetadataService;
exports.ViewMetadataService = ViewMetadataService = __decorate([
    (0, common_1.Injectable)(),
    __param(9, (0, typeorm_1.InjectEntityManager)()),
    __param(10, (0, typeorm_1.InjectRepository)(view_metadata_entity_1.ViewMetadata, 'default')),
    __param(11, (0, typeorm_1.InjectRepository)(field_metadata_entity_1.FieldMetadata)),
    __param(12, (0, typeorm_1.InjectRepository)(model_metadata_entity_1.ModelMetadata)),
    __metadata("design:paramtypes", [model_metadata_service_1.ModelMetadataService,
        module_metadata_service_1.ModuleMetadataService,
        media_storage_provider_metadata_service_1.MediaStorageProviderMetadataService,
        config_1.ConfigService,
        file_service_1.FileService,
        media_service_1.MediaService,
        core_1.DiscoveryService,
        crud_helper_service_1.CrudHelperService,
        action_metadata_service_1.ActionMetadataService,
        typeorm_2.EntityManager,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ViewMetadataService);
//# sourceMappingURL=view-metadata.service.js.map