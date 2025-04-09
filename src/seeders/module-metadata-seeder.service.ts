import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import appBuilderConfig from '../config/app-builder.config';
import { ConfigType } from '@nestjs/config';
import { CreateModuleMetadataDto } from '../dtos/create-module-metadata.dto';
import { ModuleMetadataService } from '../services/module-metadata.service';
import { CreateModelMetadataDto } from '../dtos/create-model-metadata.dto';
import { ModelMetadataService } from '../services/model-metadata.service';
import { MediaStorageProviderMetadataService } from '../services/media-storage-provider-metadata.service';
import { FieldMetadataService } from '../services/field-metadata.service';
import { UserService } from 'src/services/user.service';
import { AuthenticationService } from 'src/services/authentication.service';
import { MediaStorageProviderMetadataSeederService } from '../services/media-storage-provider-metadata-seeder.service';
import { CreateEmailTemplateDto } from 'src/dtos/create-email-template.dto';
import { EmailTemplateService } from 'src/services/email-template.service';
import { SmsTemplateService } from 'src/services/sms-template.service';
import { CreateSmsTemplateDto } from 'src/dtos/create-sms-template.dto';
import { ViewMetadataService } from '../services/view-metadata.service';
import { ActionMetadataService } from '../services/action-metadata.service';
import { MenuItemMetadataService } from '../services/menu-item-metadata.service';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionMetadata } from '../entities/permission-metadata.entity';
import { Repository } from 'typeorm';
import { SolidRegistry } from '../helpers/solid-registry';
import { RoleMetadataService } from '../services/role-metadata.service';
import { getCoreModuleNames, getDynamicModuleNames } from '../helpers/module.helper';
import solidCoreMetadata from './seed-data/solid-core-metadata.json';
import { iamConfig } from 'src/config/iam.config';
import commonConfig from 'src/config/common.config';
import { CreateSettingDto } from 'src/dtos/create-setting.dto';
import { SettingService } from 'src/services/setting.service';
import { Setting } from 'src/entities/setting.entity';

@Injectable()
export class ModuleMetadataSeederService {
    private readonly logger = new Logger(ModuleMetadataSeederService.name);

    constructor(
        private readonly moduleMetadataService: ModuleMetadataService,
        private readonly modelMetadataService: ModelMetadataService,
        private readonly fieldMetadataService: FieldMetadataService,
        private readonly mediaStorageProviderMetadataService: MediaStorageProviderMetadataService,
        private readonly roleService: RoleMetadataService,
        private readonly userService: UserService,
        private readonly authenticationService: AuthenticationService,
        private readonly solidActionService: ActionMetadataService,
        private readonly solidMenuItemService: MenuItemMetadataService,
        private readonly solidViewService: ViewMetadataService,
        private readonly mediaStorageProviderSeederService: MediaStorageProviderMetadataSeederService,
        private readonly emailTemplateService: EmailTemplateService,
        private readonly smsTemplateService: SmsTemplateService,
        @InjectRepository(PermissionMetadata)
        private readonly permissionRepo: Repository<PermissionMetadata>,
        private readonly solidRegistry: SolidRegistry,
        @Inject(appBuilderConfig.KEY)
        private readonly appBuilderConfiguration: ConfigType<typeof appBuilderConfig>,
        @Inject(iamConfig.KEY) private readonly iamConfiguration: ConfigType<typeof iamConfig>,
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
        private readonly service: SettingService,
        @InjectRepository(Setting, 'default')
        readonly settingsRepo: Repository<Setting>,
    ) { }

    async seed() {

        const typedSolidCoreMetadata: any = solidCoreMetadata;

        const settingsSeederData: any = {
            iamAllowPublicRegistration: this.iamConfiguration.allowPublicRegistration,
            iamPasswordRegistrationEnabled: true,
            iamPasswordLessRegistrationEnabled: this.iamConfiguration.passwordlessRegistration,
            iamActivateUserOnRegistration: this.iamConfiguration.activateUserOnRegistration,
            iamGoogleOAuthEnabled: false,
            authPagesLayout: "center",
            authPagesTheme: "light",
            appTitle: process.env.SOLID_APP_NAME || "Solid App",
            appLogo: "",
            appDescription: "",
            appTnc: "",
            appPrivacyPolicy: "",
            iamDefaultRole: this.iamConfiguration.defaultRole,
            shouldQueueEmails: this.commonConfiguration.shouldQueueEmails,
            shouldQueueSms: this.commonConfiguration.shouldQueueSms
        }

        // Run the permissions seeder. 
        // await this.permissionsSeederService.seed();
        this.logger.log(`Seeding permissions`);
        await this.seedPermissions();

        // TODO: move this also the main loop processing. Generate the media storage providers required by default
        this.logger.log(`Seeding media storage providers`);
        await this.mediaStorageProviderSeederService.seed();

        // Read the module metadata from a file specified in the .env 
        // Add the core json file as the first entry in the above array.
        // Please note the sequence of core files is important below...
        const coreModules = getCoreModuleNames();
        const seedDataFiles = [
            // 'src/common/seeders/seed-data/common-metadata.json',
            // 'src/iam/seeders/seed-data/iam-metadata.json',
            // 'src/app-builder/seeders/seed-data/app-builder-metadata.json',
            // 'src/queues/seeders/seed-data/queues-metadata.json',
            // ...coreModules.map(module => `src/${module}/seeders/seed-data/${module}-metadata.json`),
            typedSolidCoreMetadata
        ];
        this.logger.debug(`getting dynamics modules`);
        const enabledModules = getDynamicModuleNames();
        this.logger.log(`Seeding metadata`);

        for (let i = 0; i < enabledModules.length; i++) {
            const enabledModule = enabledModules[i];
            const enabledModuleSeedFile = `module-metadata/${enabledModule}/${enabledModule}-metadata.json`
            const fullPath = path.join(process.cwd(), enabledModuleSeedFile);
            if (fs.existsSync(fullPath)) {
                const overallMetadata: any = JSON.parse(fs.readFileSync(fullPath, 'utf-8').toString());

                seedDataFiles.push(overallMetadata)
            }
        }

        this.logger.debug(`Seed data files are: ${seedDataFiles}`);
        let usersDetail;
        for (let i = 0; i < seedDataFiles.length; i++) {

            // Module, model & field handling.
            const overallMetadata = seedDataFiles[i];
            // const fullPath = path.join(process.cwd(), seedDataFile);

            // For each module metadata seed file provided, read contents, parse & convert to a variable. 
            // this.logger.log(`[Start] module seed data: ${fullPath}`);

            // const overallMetadata: any = JSON.parse(fs.readFileSync(fullPath, 'utf-8').toString());

            // Process module metadata first. 
            const moduleMetadata: CreateModuleMetadataDto = overallMetadata.moduleMetadata;
            this.logger.debug(`[Start] Processing module metadata for ${moduleMetadata.name}`)
            await this.seedModuleModelFields(moduleMetadata);
            this.logger.debug(`[End] Processing module metadata for ${moduleMetadata.name}`)

            // Media Storage provider templates
            this.logger.debug(`[Start] Processing Media Storage Provider for ${moduleMetadata.name}`);
            const mediaStorageProviders = overallMetadata.mediaStorageProviders;
            await this.seedMediaStorageProviders(mediaStorageProviders);
            this.logger.debug(`[End] Processing Media Storage Provider for ${moduleMetadata.name}`);

            // TODO: Custom role handling
            this.logger.debug(`[End] Processing roles for ${moduleMetadata.name}`)
            const roles = overallMetadata.roles;
            await this.roleService.createRolesIfNotExists(roles);
            this.logger.debug(`[End] Processing roles for ${moduleMetadata.name}`)

            // Custom user handling
            this.logger.debug(`[Start] Processing users for ${moduleMetadata.name}`);
            const users = overallMetadata.users;
            usersDetail = users;
            await this.seedUsers(users);
            this.logger.debug(`[End] Processing users for ${moduleMetadata.name}`)

            // Application Module View handling 
            this.logger.debug(`[Start] Processing views for ${moduleMetadata.name}`);
            const views = overallMetadata.views;
            await this.seedViews(views);
            this.logger.debug(`[End] Processing views for ${moduleMetadata.name}`)

            // Application Module Action handling
            this.logger.debug(`[Start] Processing actions for ${moduleMetadata.name}`);
            const actions = overallMetadata.actions;
            await this.seedActions(actions);
            this.logger.debug(`[End] Processing actions for ${moduleMetadata.name}`)

            // Application Module Menu handling 
            this.logger.debug(`[Start] Processing menus for ${moduleMetadata.name}`);
            const menus = overallMetadata.menus;
            await this.seedMenus(menus);
            this.logger.debug(`[End] Processing menus for ${moduleMetadata.name}`)

            // Email templates 
            this.logger.debug(`[Start] Processing email templates for ${moduleMetadata.name}`);
            const emailTemplates: CreateEmailTemplateDto[] = overallMetadata.emailTemplates;
            await this.seedEmailTemplates(emailTemplates);
            this.logger.debug(`[End] Processing email templates for ${moduleMetadata.name}`);

            // Sms templates
            this.logger.debug(`[Start] Processing sms templates for ${moduleMetadata.name}`);
            const smsTemplates: CreateSmsTemplateDto[] = overallMetadata.smsTemplates;
            await this.seedSmsTemplates(smsTemplates);
            this.logger.debug(`[End] Processing sms templates for ${moduleMetadata.name}`);

            // Sms templates
            this.logger.debug(`[Start] Processing settings for ${moduleMetadata.name}`);
            await this.seedSettings(settingsSeederData);
            this.logger.debug(`[End] Processing settings for ${moduleMetadata.name}`);

            this.logger.debug(`[End] module seed data: ${overallMetadata}`);

        }

        // Post seed data file processing. 

        // 1. Give all permissions to the Admin role.
        this.logger.debug(`About to add all permissions to the Admin role`);
        await this.roleService.addAllPermissionsToRole("Admin");
        // 2. Give wrapSettings permissions to the Public role.
        const internalRolePermission = [
            'UserController.findMany',
            'UserController.checkIfPermissionExists',
            'UserController.findOne',
            'MenuItemMetadataController.findMany',
            'MenuItemMetadataController.findUserMenus',
            'MenuItemMetadataController.findOne',
            'ViewMetadataController.getLayout',
            'ViewMetadataController.findMany',
            'ViewMetadataController.findOne',
            'AuthenticationController.changePassword',
            'FieldMetadataController.getSelectionDynamicValues',
            'FieldMetadataController.getSelectionDynamicValue',
            'FieldMetadataController.findFieldDefaultMetaData',
        ]
        await this.roleService.addPermissionToRole('Internal User', internalRolePermission);
        await this.roleService.addPermissionToRole('Public', ['SettingController.wrapSettings']);
        this.logger.log(`All Seeders finished`);
        this.logger.log(`Newly created username is: ${usersDetail?.length > 0 ? usersDetail[0]?.username : ''} and password is ${usersDetail?.length > 0 ? usersDetail[0]?.password : ''}`);
    }


    async seedPermissions() {

        const controllers = this.solidRegistry.getControllers();

        // Loop over the countries and create them.
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

            } catch (error) {
                this.logger.error(error);
            }
        }
    }

    async seedMediaStorageProviders(mediaStorageProviders: any) {
        for (let i = 0; i < mediaStorageProviders.length; i++) {
            const mediaStorageProivder = mediaStorageProviders[i];
            await this.mediaStorageProviderMetadataService.upsert(mediaStorageProivder);
        }
    }

    async seedEmailTemplates(emailTemplates: CreateEmailTemplateDto[]) {
        if (!emailTemplates) {
            return;
        }

        for (let i = 0; i < emailTemplates.length; i++) {
            const emailTemplate = emailTemplates[i];
            this.logger.log(`Found ${emailTemplate.name} email template`);

            // We need to load the actual template contents. 
            // const emailTemplateFilePath = path.join(process.cwd(), emailTemplate.body);

            // emailTemplate.body = fs.readFileSync(emailTemplateFilePath, 'utf-8').toString()
            const modulePath = path.dirname(require.resolve('@solidstarters/solid-core'));

            // Resolve the `src` folder
            const seedDataPath = path.join(modulePath, '../src/seeders/seed-data/email-templates');

            // Example usage
            const filePath = path.join(seedDataPath, emailTemplate.body);


            emailTemplate.body = fs.readFileSync(filePath, 'utf-8').toString();

            // Save to DB.
            await this.emailTemplateService.removeByName(emailTemplate.name);
            await this.emailTemplateService.create(emailTemplate);
        }

    }

    async seedSmsTemplates(smsTemplates: CreateSmsTemplateDto[]) {
        if (!smsTemplates) {
            return;
        }

        for (let i = 0; i < smsTemplates.length; i++) {
            const smsTemplate = smsTemplates[i];
            this.logger.log(`Found ${smsTemplate.name} sms template`);

            // We need to load the actual template contents. 
            if (smsTemplate.body) {
                // const smsTemplateFilePath = path.join(process.cwd(), smsTemplate.body);
                // smsTemplate.body = fs.readFileSync(smsTemplateFilePath, 'utf-8').toString()

                const modulePath = path.dirname(require.resolve('@solidstarters/solid-core'));

                // Resolve the `src` folder
                const seedDataPath = path.join(modulePath, '../src/seeders/seed-data/sms-templates');

                // Example usage
                const filePath = path.join(seedDataPath, smsTemplate.body);


                smsTemplate.body = fs.readFileSync(filePath, 'utf-8').toString();

            }

            // Save to DB.
            await this.smsTemplateService.removeByName(smsTemplate.name);
            await this.smsTemplateService.create(smsTemplate);
        }
    }

    async seedMenus(menus: any) {
        if (!menus) {
            return;
        }

        for (let j = 0; j < menus.length; j++) {
            const menuData = menus[j];

            const adminRole = await this.roleService.findRoleByName('Admin');
            menuData['roles'] = [adminRole]
            menuData['action'] = await this.solidActionService.findOneByUserKey(menuData.actionUserKey);
            menuData['module'] = await this.moduleMetadataService.findOneByUserKey(menuData.moduleUserKey);

            if (menuData.parentMenuItemUserKey) {
                menuData['parentMenuItem'] = await this.solidMenuItemService.findOneByUserKey(menuData.parentMenuItemUserKey);
            } else {
                menuData['parentMenuItem'] = null
            }
            await this.solidMenuItemService.upsert(menuData);
        }
    }

    async seedActions(actions: any) {
        if (!actions) {
            return;
        }

        for (let j = 0; j < actions.length; j++) {
            const actionData = actions[j];
            actionData['module'] = await this.moduleMetadataService.findOneByUserKey(actionData.moduleUserKey);
            if (actionData.type === 'solid') {
                actionData['model'] = await this.modelMetadataService.findOneByUserKey(actionData.modelUserKey);
                actionData['view'] = await this.solidViewService.findOneByUserKey(actionData.viewUserKey);
            }
            else {
                if (actionData.modelUserKey) {
                    actionData['model'] = await this.modelMetadataService.findOneByUserKey(actionData.modelUserKey);
                }
            }
            await this.solidActionService.upsert(actionData);
        }
    }

    async seedViews(views: any) {
        if (!views) {
            return;
        }

        for (let j = 0; j < views.length; j++) {
            const viewData = views[j];

            // preety format the layout & context. 
            viewData['layout'] = JSON.stringify(viewData['layout'], null, 2);
            // viewData['context'] = JSON.stringify(viewData['context'], null, 2);

            viewData['module'] = await this.moduleMetadataService.findOneByUserKey(viewData.moduleUserKey);
            viewData['model'] = await this.modelMetadataService.findOneByUserKey(viewData.modelUserKey);
            // await this.solidViewService.upsert(viewData);
            // First check if module already exists using name
            await this.solidViewService.createIfNotPresent(viewData);

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
            // now add Roles to user.
            // for (let m = 0; m < roles.length; m++) {
            //     const role = roles[m];
            //     await this.userService.addRoleToUser(user.email, role.name);
            // }
        }
    }

    async seedModuleModelFields(moduleMetadata: CreateModuleMetadataDto) {

        // First we create the module. 
        // await this.moduleMetadataService.removeByName(moduleMetadata.name);
        // const module = await this.moduleMetadataService.create(moduleMetadata);
        const module = await this.moduleMetadataService.upsert(moduleMetadata);

        // Next create all the models. 
        const modelsMetadata: CreateModelMetadataDto[] = moduleMetadata.models;
        for (let j = 0; j < modelsMetadata.length; j++) {
            const modelMetadata = modelsMetadata[j];

            // Before creating the model, we need to make sure we are linking it to the newly created module.
            // modelMetdata['moduleId'] = module.id;
            modelMetadata['module'] = module;

            // Please note that all the fields will also get created as we have setup the relation in model.entity.ts as cascade=true
            // await this.modelMetadataService.removeBySingularName(modelMetdata.singularName);
            // await this.modelMetadataService.modelSeeder(modelMetdata);

            // upsert the model information.
            // const fieldsMetadata = modelMetdata.fields;
            // delete modelMetdata['fields'];
            const { fields: fieldsMetadata, ...modelMetaDataWithoutFields } = modelMetadata;

            // Load and set the parent model if it exists.
            if (modelMetadata.isChild && modelMetadata.parentModelUserKey) {
                const parentModel = await this.modelMetadataService.findOneByUserKey(modelMetadata.parentModelUserKey);
                modelMetaDataWithoutFields['parentModel'] = parentModel;
            }

            await this.modelMetadataService.upsert(modelMetaDataWithoutFields);
            const model = await this.modelMetadataService.findOneBySingularName(modelMetadata.singularName)

            // iterate over all fields and upsert. 
            let userKeyField = null;
            const userKeyFieldName = modelMetadata.userKeyFieldUserKey;
            for (let k = 0; k < fieldsMetadata.length; k++) {
                const fieldMetadata = fieldsMetadata[k];

                // TODO: resolve model & mediaStorageProvider. 
                fieldMetadata['model'] = model;
                if (fieldMetadata.mediaStorageProviderUserKey) {
                    fieldMetadata['mediaStorageProvider'] = await this.mediaStorageProviderMetadataService.findOneByUserKey(fieldMetadata.mediaStorageProviderUserKey);
                }
                // console.log(fieldMetadata.displayName);

                const affectedField = await this.fieldMetadataService.upsert(fieldMetadata);
                if (fieldMetadata.name === userKeyFieldName) {
                    const { model, ...fieldData } = affectedField;
                    userKeyField = fieldData;
                }
            }

            // Now that we have created fields & model update the model to stamp the userKeyField. 
            if (userKeyField) {
                modelMetaDataWithoutFields['userKeyField'] = userKeyField;
                await this.modelMetadataService.upsert(modelMetaDataWithoutFields);
            }
        }
    }

    async seedSettings(createDto: CreateSettingDto) {
        const settingsArray: any[] = await this.settingsRepo.find();
        if (!settingsArray || settingsArray.length === 0) {
            this.service.create(createDto);
        }
    }
}