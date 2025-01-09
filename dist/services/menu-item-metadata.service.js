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
exports.MenuItemMetadataService = void 0;
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
const menu_item_metadata_entity_1 = require("../entities/menu-item-metadata.entity");
const strings_1 = require("@angular-devkit/core/src/utils/strings");
const permission_metadata_service_1 = require("./permission-metadata.service");
let MenuItemMetadataService = class MenuItemMetadataService extends crud_service_1.CRUDService {
    constructor(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo) {
        super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, 'menuItemMetadata', 'app-builder');
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
    async upsert(updateSolidMenuItemDto) {
        const { moduleUserKey, parentMenuItemUserKey, actionUserKey, rolesIds, rolesCommand, ...cleanUpdateSolidMenuItemDto } = updateSolidMenuItemDto;
        const existingMenuItem = await this.repo.findOne({
            where: {
                name: updateSolidMenuItemDto.name
            },
            relations: ["roles"]
        });
        if (existingMenuItem) {
            const updatedSolidActionDto = { ...existingMenuItem, ...cleanUpdateSolidMenuItemDto };
            return this.repo.save(updatedSolidActionDto);
        }
        else {
            const moduleMetadata = this.repo.create(cleanUpdateSolidMenuItemDto);
            return this.repo.save(moduleMetadata);
        }
    }
    async findUserMenus(activeUser) {
        const menuItems = await this.repo
            .createQueryBuilder('menuItem')
            .leftJoinAndSelect('menuItem.module', 'module')
            .leftJoinAndSelect('menuItem.parentMenuItem', 'parentMenuItem')
            .leftJoinAndSelect('menuItem.action', 'action')
            .leftJoinAndSelect('action.model', 'model')
            .leftJoinAndSelect('action.view', 'view')
            .leftJoinAndSelect('menuItem.roles', 'roles')
            .where('roles.name IN (:...roleNames)', { roleNames: activeUser.roles })
            .addOrderBy('module.menuSequenceNumber', 'ASC')
            .addOrderBy('menuItem.sequenceNumber', 'ASC')
            .getMany();
        const modulesToMenuItemsMap = new Map();
        const modulesMap = new Map();
        menuItems.forEach(menuItem => {
            const moduleName = menuItem.module.name;
            if (!modulesToMenuItemsMap.has(moduleName)) {
                modulesToMenuItemsMap.set(moduleName, []);
            }
            modulesToMenuItemsMap.get(moduleName).push(menuItem);
            if (!modulesMap.has(moduleName)) {
                modulesMap.set(moduleName, menuItem.module);
            }
        });
        const menu = [];
        modulesToMenuItemsMap.forEach((menuItems, moduleName) => {
            const rootMenuItems = menuItems.filter(item => !item.parentMenuItem);
            const moduleMetadata = modulesMap.get(moduleName);
            const moduleMenu = {
                title: moduleMetadata.displayName,
                key: moduleName.toLowerCase().replace(/\s+/g, '-'),
                children: this.buildMenuTree(rootMenuItems, menuItems, activeUser),
                icon: moduleMetadata.menuIconUrl,
            };
            menu.push(moduleMenu);
        });
        return menu.filter(m => m.children.length > 0);
    }
    buildMenuTree(rootItems, allMenuItems, activeUser) {
        const menuItemsData = rootItems.map(rootItem => {
            const children = allMenuItems.filter(item => item.parentMenuItem && item.parentMenuItem.id === rootItem.id);
            let path = '';
            if (rootItem.action && rootItem.action.type === 'custom') {
                path = rootItem.action.customComponent;
            }
            if (rootItem.action && rootItem.action.type === 'solid') {
                if ((0, permission_metadata_service_1.hasReadPermissionOnModel)(activeUser, rootItem.action.model.singularName)) {
                    path = `/admin/core/${rootItem.module.name}/${(0, strings_1.dasherize)(rootItem.action.model.singularName)}/${rootItem.action.view.type}`;
                }
            }
            const data = {
                title: rootItem.displayName || rootItem.name,
                path: path,
                key: rootItem.name.toLowerCase().replace(/\s+/g, '-'),
            };
            if (children.length > 0) {
                data["children"] = this.buildMenuTree(children, allMenuItems, activeUser);
            }
            return data;
        });
        return menuItemsData.filter(mi => mi && mi);
    }
};
exports.MenuItemMetadataService = MenuItemMetadataService;
exports.MenuItemMetadataService = MenuItemMetadataService = __decorate([
    (0, common_1.Injectable)(),
    __param(8, (0, typeorm_1.InjectEntityManager)()),
    __param(9, (0, typeorm_1.InjectRepository)(menu_item_metadata_entity_1.MenuItemMetadata, 'default')),
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
], MenuItemMetadataService);
//# sourceMappingURL=menu-item-metadata.service.js.map