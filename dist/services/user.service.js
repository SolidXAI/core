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
exports.UserService = void 0;
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
const user_entity_1 = require("../entities/user.entity");
const role_metadata_entity_1 = require("../entities/role-metadata.entity");
let UserService = class UserService extends crud_service_1.CRUDService {
    constructor(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, roleRepository) {
        super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, 'user', 'solid-core');
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
        this.roleRepository = roleRepository;
    }
    async findOneByEmail(email) {
        return await this.repo.findOne({
            where: {
                email: email
            },
            relations: {}
        });
    }
    async findOneByAccessCode(accessCode) {
        return await this.repo.findOne({
            where: {
                accessCode: accessCode
            },
            relations: {}
        });
    }
    async findOneByUsername(username) {
        return await this.repo.findOne({
            where: {
                username: username
            },
            relations: {}
        });
    }
    async addRoleToUser(username, roleName) {
        const user = await this.repo.findOne({
            where: { username: username },
            relations: {
                roles: true
            }
        });
        if (!user) {
            throw new Error(`User with username '${username}' not found.`);
        }
        const role = await this.roleRepository.findOne({ where: { name: roleName } });
        if (!role) {
            throw new Error(`Role '${roleName}' not found.`);
        }
        if (user.roles && user.roles.length > 0) {
            user.roles.push(role);
        }
        else {
            user.roles = [role];
        }
        return await this.repo.save(user);
    }
    async addRolesToUser(username, roleNames) {
        const user = await this.repo.findOne({
            where: { username: username },
            relations: { roles: true }
        });
        if (!user) {
            throw new Error(`User with username '${username}' not found.`);
        }
        const roles = await this.roleRepository.find({
            where: roleNames.map(roleName => ({ name: roleName }))
        });
        if (roles.length !== roleNames.length) {
            const foundRoleNames = roles.map(role => role.name);
            const missingRoles = roleNames.filter(roleName => !foundRoleNames.includes(roleName));
            throw new Error(`The following roles were not found: ${missingRoles.join(', ')}`);
        }
        const currentRoles = user.roles.map(role => role.name);
        const rolesToAdd = roles.filter(role => !currentRoles.includes(role.name));
        const rolesToRemove = user.roles.filter(role => !roleNames.includes(role.name));
        if (rolesToAdd.length > 0) {
            user.roles.push(...rolesToAdd);
        }
        if (rolesToRemove.length > 0) {
            user.roles = user.roles.filter(role => !rolesToRemove.includes(role));
        }
        return await this.repo.save(user);
    }
    async removeRoleFromUser(username, roleName) {
        const user = await this.repo.findOne({
            where: {
                username: username
            },
            relations: {
                roles: true
            }
        });
        if (!user) {
            throw new Error(`User with username '${username}' not found.`);
        }
        user.roles = user.roles.filter(role => role.name !== roleName);
        return await this.repo.save(user);
    }
    async resolveUserOnOauthGoogle(oauthUserDto) {
        const user = await this.repo.findOne({
            where: {
                email: oauthUserDto.email,
            },
            relations: {
                roles: true
            }
        });
        if (!user) {
            const user = new user_entity_1.User();
            user.username = oauthUserDto.email;
            user.email = oauthUserDto.email;
            user.lastLoginProvider = oauthUserDto.provider;
            user.accessCode = oauthUserDto.accessCode;
            user.googleAccessToken = oauthUserDto.accessToken;
            user.googleId = oauthUserDto.providerId;
            user.googleProfilePicture = oauthUserDto.picture;
            return await this.repo.save(user);
        }
        else {
            const entity = await this.repo.preload({
                id: user.id,
                lastLoginProvider: oauthUserDto.provider,
                accessCode: oauthUserDto.accessCode,
                googleAccessToken: oauthUserDto.accessToken,
                googleId: oauthUserDto.providerId,
                googleProfilePicture: oauthUserDto.picture,
            });
            await this.repo.save(entity);
        }
        return user;
    }
    async findUsersByRole(roleName, relations = {}) {
        return await this.repo.find({
            where: {
                roles: {
                    name: roleName
                }
            },
            relations: relations
        });
    }
    async checkIfPermissionExists(query, activeUser) {
        const matchingPermssions = activeUser.permissions.filter((p) => query.permissionNames.includes(p));
        return matchingPermssions;
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(8, (0, typeorm_1.InjectEntityManager)()),
    __param(9, (0, typeorm_1.InjectRepository)(user_entity_1.User, 'default')),
    __param(10, (0, typeorm_1.InjectRepository)(role_metadata_entity_1.RoleMetadata)),
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
], UserService);
//# sourceMappingURL=user.service.js.map