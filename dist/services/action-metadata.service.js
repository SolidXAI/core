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
exports.ActionMetadataService = void 0;
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
const action_metadata_entity_1 = require("../entities/action-metadata.entity");
let ActionMetadataService = class ActionMetadataService extends crud_service_1.CRUDService {
    constructor(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo) {
        super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, 'actionMetadata', 'app-builder');
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
    async upsert(updateSolidActionDto) {
        const existingSolidAction = await this.repo.findOne({
            where: {
                name: updateSolidActionDto.name
            }
        });
        if (existingSolidAction) {
            const updatedSolidActionDto = { ...existingSolidAction, ...updateSolidActionDto };
            return this.repo.save(updatedSolidActionDto);
        }
        else {
            const moduleMetadata = this.repo.create(updateSolidActionDto);
            return this.repo.save(moduleMetadata);
        }
    }
};
exports.ActionMetadataService = ActionMetadataService;
exports.ActionMetadataService = ActionMetadataService = __decorate([
    (0, common_1.Injectable)(),
    __param(8, (0, typeorm_1.InjectEntityManager)()),
    __param(9, (0, typeorm_1.InjectRepository)(action_metadata_entity_1.ActionMetadata, 'default')),
    __metadata("design:paramtypes", [model_metadata_service_1.ModelMetadataService,
        module_metadata_service_1.ModuleMetadataService,
        media_storage_provider_metadata_service_1.MediaStorageProviderMetadataService,
        config_1.ConfigService,
        file_service_1.FileService,
        media_service_1.MediaService,
        core_1.DiscoveryService,
        crud_helper_service_1.CrudHelperService,
        typeorm_2.EntityManager,
        typeorm_2.Repository])
], ActionMetadataService);
//# sourceMappingURL=action-metadata.service.js.map