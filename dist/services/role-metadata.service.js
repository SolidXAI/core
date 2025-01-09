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
var RoleMetadataService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleMetadataService = void 0;
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
const role_metadata_entity_1 = require("../entities/role-metadata.entity");
const permission_metadata_entity_1 = require("../entities/permission-metadata.entity");
let RoleMetadataService = RoleMetadataService_1 = class RoleMetadataService extends crud_service_1.CRUDService {
    constructor(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, permissionRepository) {
        super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, 'roleMetadata', 'solid-core');
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
        this.permissionRepository = permissionRepository;
        this.logger = new common_1.Logger(RoleMetadataService_1.name);
    }
    async findRoleByName(roleName) {
        const entity = await this.repo.findOne({
            where: {
                name: roleName
            },
            relations: {
                permissions: true
            }
        });
        if (!entity) {
            throw new common_1.NotFoundException(`Entity #${roleName} not found`);
        }
        return entity;
    }
    async createRolesIfNotExists(roles) {
        for (let id = 0; id < roles.length; id++) {
            try {
                const roleObj = roles[id];
                this.logger.log(`Resolving role: ${JSON.stringify(roleObj)}`);
                const existingRole = await this.repo.findOne({
                    where: {
                        name: roleObj.name,
                    },
                    relations: {},
                });
                if (!existingRole) {
                    this.logger.log(`Role ${roleObj.name} does not exist, hence creating`);
                    let permissions = [];
                    if (roleObj.permissions && roleObj.permissions.length > 0) {
                        await Promise.all(roleObj.permissions.map(permission => this.preloadPermissionByName(permission.name)));
                    }
                    const role = this.repo.create({ ...roleObj });
                    await this.repo.save(role);
                }
                else {
                    this.logger.log(`Role ${roleObj.name} already exists`);
                }
            }
            catch (error) {
                this.logger.error(error);
            }
        }
    }
    async addAllPermissionsToRole(roleName) {
        return await this._addPermissionsToRole(roleName, null);
    }
    async addPermissionsToRole(roleName, permissionNames) {
        return await this._addPermissionsToRole(roleName, permissionNames);
    }
    async addPermissionToRole(roleName, permissionName) {
        return await this._addPermissionsToRole(roleName, [permissionName]);
    }
    async _addPermissionsToRole(roleName, permissionNames) {
        const role = await this.repo.findOne({
            where: { name: roleName },
            relations: {
                permissions: true
            }
        });
        if (!role) {
            throw new Error(`Role '${roleName}' not found.`);
        }
        this.logger.log(`Found role ${roleName}`);
        let newPermissions;
        if (permissionNames && permissionNames.length != 0) {
            this.logger.log(`Loading specified permissions.`);
            newPermissions = await this.permissionRepository.find({ where: { name: (0, typeorm_2.In)(permissionNames) } });
            if (newPermissions.length !== permissionNames.length) {
                throw new Error(`One or more permissions not found.`);
            }
        }
        else {
            this.logger.log(`Loading all permissions in system.`);
            newPermissions = await this.permissionRepository.find();
            if (newPermissions.length == 0) {
                throw new Error(`No permissions configured in the system. Did you forget to run the PermissionSeederService?`);
            }
        }
        this.logger.log(`Adding ${newPermissions.length} permissions to role ${roleName}.`);
        if (role.permissions && role.permissions.length > 0) {
            for (let i = 0; i < newPermissions.length; i++) {
                const newPermission = newPermissions[i];
                let newPermissionFound = true;
                for (let j = 0; j < role.permissions.length; j++) {
                    const existingPermission = role.permissions[j];
                    if (existingPermission.name === newPermission.name) {
                        newPermissionFound = false;
                        break;
                    }
                }
                if (newPermissionFound) {
                    role.permissions.push(newPermission);
                }
            }
        }
        else {
            role.permissions = newPermissions;
        }
        return await this.repo.save(role);
    }
    async removePermissionsFromRole(roleName, permissionNames) {
        const role = await this.repo.findOne({
            where: {
                name: roleName
            },
            relations: {
                permissions: true
            }
        });
        if (!role) {
            throw new Error(`Role ${roleName} not found.`);
        }
        role.permissions = role.permissions.filter(permission => !permissionNames.includes(permission.name));
        return await this.repo.save(role);
    }
    async preloadPermissionByName(name) {
        const existingPermission = await this.permissionRepository.findOne({
            where: { name },
        });
        if (!existingPermission) {
            throw new common_1.NotFoundException(`Permission ${name} does not exist`);
        }
        return existingPermission;
    }
};
exports.RoleMetadataService = RoleMetadataService;
exports.RoleMetadataService = RoleMetadataService = RoleMetadataService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => model_metadata_service_1.ModelMetadataService))),
    __param(8, (0, typeorm_1.InjectEntityManager)()),
    __param(9, (0, typeorm_1.InjectRepository)(role_metadata_entity_1.RoleMetadata, 'default')),
    __param(10, (0, typeorm_1.InjectRepository)(permission_metadata_entity_1.PermissionMetadata)),
    __metadata("design:paramtypes", [model_metadata_service_1.ModelMetadataService,
        module_metadata_service_1.ModuleMetadataService,
        media_storage_provider_metadata_service_1.MediaStorageProviderMetadataService,
        config_1.ConfigService,
        file_service_1.FileService,
        media_service_1.MediaService,
        core_1.DiscoveryService,
        crud_helper_service_1.CrudHelperService,
        typeorm_2.EntityManager,
        typeorm_2.Repository,
        typeorm_2.Repository])
], RoleMetadataService);
//# sourceMappingURL=role-metadata.service.js.map