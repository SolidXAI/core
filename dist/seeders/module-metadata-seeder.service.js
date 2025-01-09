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
var ModuleMetadataSeederService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleMetadataSeederService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path = require("path");
const app_builder_config_1 = require("../config/app-builder.config");
const module_metadata_service_1 = require("../services/module-metadata.service");
const model_metadata_service_1 = require("../services/model-metadata.service");
const media_storage_provider_metadata_service_1 = require("../services/media-storage-provider-metadata.service");
const field_metadata_service_1 = require("../services/field-metadata.service");
const user_service_1 = require("../services/user.service");
const authentication_service_1 = require("../services/authentication.service");
const media_storage_provider_metadata_seeder_service_1 = require("../services/media-storage-provider-metadata-seeder.service");
const email_template_service_1 = require("../services/email-template.service");
const sms_template_service_1 = require("../services/sms-template.service");
const view_metadata_service_1 = require("../services/view-metadata.service");
const action_metadata_service_1 = require("../services/action-metadata.service");
const menu_item_metadata_service_1 = require("../services/menu-item-metadata.service");
const typeorm_1 = require("@nestjs/typeorm");
const permission_metadata_entity_1 = require("../entities/permission-metadata.entity");
const typeorm_2 = require("typeorm");
const solid_registry_1 = require("../helpers/solid-registry");
const role_metadata_service_1 = require("../services/role-metadata.service");
const module_helper_1 = require("../helpers/module.helper");
let ModuleMetadataSeederService = ModuleMetadataSeederService_1 = class ModuleMetadataSeederService {
    constructor(moduleMetadataService, modelMetadataService, fieldMetadataService, mediaStorageProviderMetadataService, roleService, userService, authenticationService, solidActionService, solidMenuItemService, solidViewService, mediaStorageProviderSeederService, emailTemplateService, smsTemplateService, permissionRepo, solidRegistry, appBuilderConfiguration) {
        this.moduleMetadataService = moduleMetadataService;
        this.modelMetadataService = modelMetadataService;
        this.fieldMetadataService = fieldMetadataService;
        this.mediaStorageProviderMetadataService = mediaStorageProviderMetadataService;
        this.roleService = roleService;
        this.userService = userService;
        this.authenticationService = authenticationService;
        this.solidActionService = solidActionService;
        this.solidMenuItemService = solidMenuItemService;
        this.solidViewService = solidViewService;
        this.mediaStorageProviderSeederService = mediaStorageProviderSeederService;
        this.emailTemplateService = emailTemplateService;
        this.smsTemplateService = smsTemplateService;
        this.permissionRepo = permissionRepo;
        this.solidRegistry = solidRegistry;
        this.appBuilderConfiguration = appBuilderConfiguration;
        this.logger = new common_1.Logger(ModuleMetadataSeederService_1.name);
    }
    async seed() {
        await this.seedPermissions();
        await this.mediaStorageProviderSeederService.seed();
        const coreModules = (0, module_helper_1.getCoreModuleNames)();
        const seedDataFiles = [
            ...coreModules.map(module => `src/${module}/seeders/seed-data/${module}-metadata.json`),
        ];
        const enabledModules = (0, module_helper_1.getDynamicModuleNames)();
        for (let i = 0; i < enabledModules.length; i++) {
            const enabledModule = enabledModules[i];
            const enabledModuleSeedFile = `module-metadata/${enabledModule}/${enabledModule}-metadata.json`;
            const fullPath = path.join(process.cwd(), enabledModuleSeedFile);
            if (fs.existsSync(fullPath)) {
                seedDataFiles.push(enabledModuleSeedFile);
            }
        }
        this.logger.log(`Seed data files are: ${seedDataFiles}`);
        for (let i = 0; i < seedDataFiles.length; i++) {
            const seedDataFile = seedDataFiles[i];
            const fullPath = path.join(process.cwd(), seedDataFile);
            this.logger.log(`[Start] module seed data: ${fullPath}`);
            const overallMetadata = JSON.parse(fs.readFileSync(fullPath, 'utf-8').toString());
            const moduleMetadata = overallMetadata.moduleMetadata;
            this.logger.log(`[Start] Processing module metadata for ${moduleMetadata.name}`);
            await this.seedModuleModelFields(moduleMetadata);
            this.logger.log(`[End] Processing module metadata for ${moduleMetadata.name}`);
            this.logger.log(`[Start] Processing Media Storage Provider for ${moduleMetadata.name}`);
            const mediaStorageProviders = overallMetadata.mediaStorageProviders;
            await this.seedMediaStorageProviders(mediaStorageProviders);
            this.logger.log(`[End] Processing Media Storage Provider for ${moduleMetadata.name}`);
            this.logger.log(`[End] Processing roles for ${moduleMetadata.name}`);
            const roles = overallMetadata.roles;
            await this.roleService.createRolesIfNotExists(roles);
            this.logger.log(`[End] Processing roles for ${moduleMetadata.name}`);
            this.logger.log(`[Start] Processing users for ${moduleMetadata.name}`);
            const users = overallMetadata.users;
            await this.seedUsers(users);
            this.logger.log(`[End] Processing users for ${moduleMetadata.name}`);
            this.logger.log(`[Start] Processing views for ${moduleMetadata.name}`);
            const views = overallMetadata.views;
            await this.seedViews(views);
            this.logger.log(`[End] Processing views for ${moduleMetadata.name}`);
            this.logger.log(`[Start] Processing actions for ${moduleMetadata.name}`);
            const actions = overallMetadata.actions;
            await this.seedActions(actions);
            this.logger.log(`[End] Processing actions for ${moduleMetadata.name}`);
            this.logger.log(`[Start] Processing menus for ${moduleMetadata.name}`);
            const menus = overallMetadata.menus;
            await this.seedMenus(menus);
            this.logger.log(`[End] Processing menus for ${moduleMetadata.name}`);
            this.logger.log(`[Start] Processing email templates for ${moduleMetadata.name}`);
            const emailTemplates = overallMetadata.emailTemplates;
            await this.seedEmailTemplates(emailTemplates);
            this.logger.log(`[End] Processing email templates for ${moduleMetadata.name}`);
            this.logger.log(`[Start] Processing sms templates for ${moduleMetadata.name}`);
            const smsTemplates = overallMetadata.smsTemplates;
            await this.seedSmsTemplates(smsTemplates);
            this.logger.log(`[End] Processing sms templates for ${moduleMetadata.name}`);
            this.logger.log(`[End] module seed data: ${fullPath}`);
        }
        this.logger.log(`About to add all permissions to the Admin role`);
        await this.roleService.addAllPermissionsToRole("Admin");
        this.logger.log(`All Seeders finished`);
    }
    async seedPermissions() {
        const controllers = this.solidRegistry.getControllers();
        for (let id = 0; id < controllers.length; id++) {
            try {
                const controller = controllers[id];
                this.logger.log(`Resolving controller: ${controller.name}`);
                const methods = controller.methods;
                for (let mId = 0; mId < methods.length; mId++) {
                    const methodName = methods[mId];
                    const permissionName = `${controller.name}.${methodName}`;
                    const existingPermission = await this.permissionRepo.findOne({
                        where: {
                            name: permissionName
                        }
                    });
                    if (existingPermission) {
                        this.logger.log(`Permission ${permissionName} already exists.`);
                    }
                    else {
                        this.logger.log(`Permission ${permissionName} does not exist, creating new.`);
                        const newPermission = this.permissionRepo.create({
                            name: permissionName
                        });
                        await this.permissionRepo.save(newPermission);
                    }
                }
            }
            catch (error) {
                this.logger.error(error);
            }
        }
    }
    async seedMediaStorageProviders(mediaStorageProviders) {
        for (let i = 0; i < mediaStorageProviders.length; i++) {
            const mediaStorageProivder = mediaStorageProviders[i];
            await this.mediaStorageProviderMetadataService.upsert(mediaStorageProivder);
        }
    }
    async seedEmailTemplates(emailTemplates) {
        if (!emailTemplates) {
            return;
        }
        for (let i = 0; i < emailTemplates.length; i++) {
            const emailTemplate = emailTemplates[i];
            this.logger.log(`Found ${emailTemplate.name} email template`);
            const emailTemplateFilePath = path.join(process.cwd(), emailTemplate.body);
            emailTemplate.body = fs.readFileSync(emailTemplateFilePath, 'utf-8').toString();
            await this.emailTemplateService.removeByName(emailTemplate.name);
            await this.emailTemplateService.create(emailTemplate);
        }
    }
    async seedSmsTemplates(smsTemplates) {
        if (!smsTemplates) {
            return;
        }
        for (let i = 0; i < smsTemplates.length; i++) {
            const smsTemplate = smsTemplates[i];
            this.logger.log(`Found ${smsTemplate.name} sms template`);
            if (smsTemplate.body) {
                const smsTemplateFilePath = path.join(process.cwd(), smsTemplate.body);
                smsTemplate.body = fs.readFileSync(smsTemplateFilePath, 'utf-8').toString();
            }
            await this.smsTemplateService.removeByName(smsTemplate.name);
            await this.smsTemplateService.create(smsTemplate);
        }
    }
    async seedMenus(menus) {
        if (!menus) {
            return;
        }
        for (let j = 0; j < menus.length; j++) {
            const menuData = menus[j];
            const adminRole = await this.roleService.findRoleByName('Admin');
            menuData['roles'] = [adminRole];
            menuData['action'] = await this.solidActionService.findOneByUserKey(menuData.actionUserKey);
            menuData['module'] = await this.moduleMetadataService.findOneByUserKey(menuData.moduleUserKey);
            if (menuData.parentMenuItemUserKey) {
                menuData['parentMenuItem'] = await this.solidMenuItemService.findOneByUserKey(menuData.parentMenuItemUserKey);
            }
            else {
                menuData['parentMenuItem'] = null;
            }
            await this.solidMenuItemService.upsert(menuData);
        }
    }
    async seedActions(actions) {
        if (!actions) {
            return;
        }
        for (let j = 0; j < actions.length; j++) {
            const actionData = actions[j];
            actionData['module'] = await this.moduleMetadataService.findOneByUserKey(actionData.moduleUserKey);
            if (actionData.type === 'solid') {
                actionData['view'] = await this.solidViewService.findOneByUserKey(actionData.viewUserKey);
                actionData['model'] = await this.modelMetadataService.findOneByUserKey(actionData.modelUserKey);
            }
            await this.solidActionService.upsert(actionData);
        }
    }
    async seedViews(views) {
        if (!views) {
            return;
        }
        for (let j = 0; j < views.length; j++) {
            const viewData = views[j];
            viewData['layout'] = JSON.stringify(viewData['layout'], null, 2);
            viewData['module'] = await this.moduleMetadataService.findOneByUserKey(viewData.moduleUserKey);
            viewData['model'] = await this.modelMetadataService.findOneByUserKey(viewData.modelUserKey);
            await this.solidViewService.upsert(viewData);
        }
    }
    async seedUsers(users) {
        if (!users) {
            return;
        }
        for (let l = 0; l < users.length; l++) {
            const user = users[l];
            let exisitingUser = await this.userService.findOneByUsername(user.username);
            if (!exisitingUser) {
                exisitingUser = await this.authenticationService.signUp(user);
                this.logger.log(`Newly created user is ${user}`);
            }
        }
    }
    async seedModuleModelFields(moduleMetadata) {
        const module = await this.moduleMetadataService.upsert(moduleMetadata);
        const modelsMetadata = moduleMetadata.models;
        for (let j = 0; j < modelsMetadata.length; j++) {
            const modelMetadata = modelsMetadata[j];
            modelMetadata['module'] = module;
            const { fields: fieldsMetadata, ...modelMetaDataWithoutFields } = modelMetadata;
            await this.modelMetadataService.upsert(modelMetaDataWithoutFields);
            const model = await this.modelMetadataService.findOneBySingularName(modelMetadata.singularName);
            let userKeyField = null;
            const userKeyFieldName = modelMetadata.userKeyFieldUserKey;
            for (let k = 0; k < fieldsMetadata.length; k++) {
                const fieldMetadata = fieldsMetadata[k];
                fieldMetadata['model'] = model;
                if (fieldMetadata.mediaStorageProviderUserKey) {
                    fieldMetadata['mediaStorageProvider'] = await this.mediaStorageProviderMetadataService.findOneByUserKey(fieldMetadata.mediaStorageProviderUserKey);
                }
                const affectedField = await this.fieldMetadataService.upsert(fieldMetadata);
                if (fieldMetadata.name === userKeyFieldName) {
                    const { model, ...fieldData } = affectedField;
                    userKeyField = fieldData;
                }
            }
            if (userKeyField) {
                modelMetaDataWithoutFields['userKeyField'] = userKeyField;
                await this.modelMetadataService.upsert(modelMetaDataWithoutFields);
            }
        }
    }
};
exports.ModuleMetadataSeederService = ModuleMetadataSeederService;
exports.ModuleMetadataSeederService = ModuleMetadataSeederService = ModuleMetadataSeederService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(13, (0, typeorm_1.InjectRepository)(permission_metadata_entity_1.PermissionMetadata)),
    __param(15, (0, common_1.Inject)(app_builder_config_1.default.KEY)),
    __metadata("design:paramtypes", [module_metadata_service_1.ModuleMetadataService,
        model_metadata_service_1.ModelMetadataService,
        field_metadata_service_1.FieldMetadataService,
        media_storage_provider_metadata_service_1.MediaStorageProviderMetadataService,
        role_metadata_service_1.RoleMetadataService,
        user_service_1.UserService,
        authentication_service_1.AuthenticationService,
        action_metadata_service_1.ActionMetadataService,
        menu_item_metadata_service_1.MenuItemMetadataService,
        view_metadata_service_1.ViewMetadataService,
        media_storage_provider_metadata_seeder_service_1.MediaStorageProviderMetadataSeederService,
        email_template_service_1.EmailTemplateService,
        sms_template_service_1.SmsTemplateService,
        typeorm_2.Repository,
        solid_registry_1.SolidRegistry, void 0])
], ModuleMetadataSeederService);
//# sourceMappingURL=module-metadata-seeder.service.js.map