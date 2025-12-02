import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import commonConfig from 'src/config/common.config';
import { iamConfig } from 'src/config/iam.config';
import { CreateDashboardDto } from 'src/dtos/create-dashboard.dto';
import { CreateEmailTemplateDto } from 'src/dtos/create-email-template.dto';
import { CreateListOfValuesDto } from 'src/dtos/create-list-of-values.dto';
import { CreateSecurityRuleDto } from 'src/dtos/create-security-rule.dto';
import { CreateSettingDto } from 'src/dtos/create-setting.dto';
import { CreateSmsTemplateDto } from 'src/dtos/create-sms-template.dto';
import { Setting } from 'src/entities/setting.entity';
import { DashboardRepository } from 'src/repository/dashboard.repository';
import { SecurityRuleRepository } from 'src/repository/security-rule.repository';
import { AuthenticationService } from 'src/services/authentication.service';
import { EmailTemplateService } from 'src/services/email-template.service';
import { ListOfValuesService } from 'src/services/list-of-values.service';
import { SettingService } from 'src/services/setting.service';
import { SmsTemplateService } from 'src/services/sms-template.service';
import { UserService } from 'src/services/user.service';
import { DataSource, In, Repository } from 'typeorm';
import appBuilderConfig from '../config/app-builder.config';
import { CreateModelMetadataDto } from '../dtos/create-model-metadata.dto';
import { CreateModuleMetadataDto } from '../dtos/create-module-metadata.dto';
import { PermissionMetadata } from '../entities/permission-metadata.entity';
import { getDynamicModuleNames } from '../helpers/module.helper';
import { SolidRegistry } from '../helpers/solid-registry';
import { ActionMetadataService } from '../services/action-metadata.service';
import { FieldMetadataService } from '../services/field-metadata.service';
import { MediaStorageProviderMetadataSeederService } from '../services/media-storage-provider-metadata-seeder.service';
import { MediaStorageProviderMetadataService } from '../services/media-storage-provider-metadata.service';
import { MenuItemMetadataService } from '../services/menu-item-metadata.service';
import { ModelMetadataService } from '../services/model-metadata.service';
import { ModuleMetadataService } from '../services/module-metadata.service';
import { RoleMetadataService } from '../services/role-metadata.service';
import { ViewMetadataService } from '../services/view-metadata.service';
import solidCoreMetadata from './seed-data/solid-core-metadata.json';
import { SystemFieldsSeederService } from './system-fields-seeder.service';
// import { CreateScheduledJobDto } from 'src/dtos/create-scheduled-job.dto';
import { ActionMetadata, MENU_ROLE_JOIN_TABLE_NAME, MENU_ROLE_JOIN_TABLE_NAME_MENU_COL, MENU_ROLE_JOIN_TABLE_NAME_ROLE_COL, MenuItemMetadata, ModuleMetadata, RoleMetadata } from 'src';
import { ADMIN_ROLE_NAME, INTERNAL_ROLE_NAME, INTERNAL_ROLE_PERMISSIONS, PUBLIC_ROLE_NAME } from 'src/dtos/create-role-metadata.dto';
import { CreateScheduledJobDto } from 'src/dtos/create-scheduled-job.dto';
import { ScheduledJobRepository } from 'src/repository/scheduled-job.repository';
import { PermissionMetadataRepository } from 'src/repository/permission-metadata.repository';
import { SettingRepository } from 'src/repository/setting.repository';
import { CreateSavedFiltersDto } from 'src/dtos/create-saved-filters.dto';
import { SavedFiltersRepository } from 'src/repository/saved-filters.repository';


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
        private readonly listOfValuesService: ListOfValuesService,
        // @InjectRepository(PermissionMetadata)
        // private readonly permissionRepo: Repository<PermissionMetadata>,
        private readonly permissionRepo: PermissionMetadataRepository,
        private readonly solidRegistry: SolidRegistry,
        @Inject(appBuilderConfig.KEY)
        private readonly appBuilderConfiguration: ConfigType<typeof appBuilderConfig>,
        @Inject(iamConfig.KEY) private readonly iamConfiguration: ConfigType<typeof iamConfig>,
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
        private readonly settingService: SettingService,
        // @InjectRepository(Setting, 'default')
        // readonly settingsRepo: Repository<Setting>,
        private readonly settingsRepo: SettingRepository,
        readonly securityRuleRepo: SecurityRuleRepository,
        readonly systemFieldsSeederService: SystemFieldsSeederService,
        readonly dashboardRepo: DashboardRepository,
        readonly scheduledJobRepository: ScheduledJobRepository,
        readonly savedFiltersRepo: SavedFiltersRepository,
        readonly dataSource: DataSource,
    ) { }

    async seed(conf?: any) {
        // Global seeding steps i.e across all modules
        await this.seedGlobalMetadata();

        // Module specific seeding steps.
        // Get all the module metadata files which needs to be seeded.
        const seedDataFiles = this.seedDataFiles;
        this.logger.debug(`Seed data files are: ${seedDataFiles}`);
        // let usersDetail;
        // For each module metadata file, we will process the seeding steps one by one.
        for (let i = 0; i < seedDataFiles.length; i++) {
            const overallMetadata = seedDataFiles[i];
            const moduleMetadata: CreateModuleMetadataDto = overallMetadata.moduleMetadata;
            this.logger.log(`Seeding Metadata for Module: ${moduleMetadata.name}`);

            // Process module metadata first. 
            this.logger.log(`Seeding Module / Model / Fields`);
            await this.seedModuleModelFields(moduleMetadata);

            // Media Storage provider templates
            this.logger.log(`Seeding Media Storage Providers`);
            await this.seedMediaStorageProviders(overallMetadata.mediaStorageProviders);

            // Custom role handling
            this.logger.log(`Seeding Roles`);
            await this.seedRoles(overallMetadata);

            // Custom user handling
            this.logger.log(`Seeding Users`);
            await this.seedUsers(overallMetadata);

            // Application Module View handling 
            this.logger.log(`Seeding Views`);
            await this.seedViews(overallMetadata);

            // Application Module Action handling
            this.logger.log(`Seeding Actions`);
            await this.seedActions(overallMetadata);

            // Application Module Menu handling 
            this.logger.log(`Seeding Menus`);
            await this.seedMenus(overallMetadata);

            // Email templates 
            this.logger.log(`Seeding Email Templates`);
            await this.seedEmailTemplates(overallMetadata, moduleMetadata.name);

            // Sms templates
            this.logger.log(`Seeding Sms Templates`);
            await this.seedSmsTemplates(overallMetadata, moduleMetadata.name);

            // Settings
            this.logger.log(`Seeding Default Settings`);
            await this.seedDefaultSettings();

            // Security rules
            this.logger.log(`Seeding Security Rules`);
            await this.seedSecurityRules(overallMetadata);

            // List Of Values
            this.logger.log(`Seeding List Of Values`);
            await this.seedListOfValues(moduleMetadata, overallMetadata);

            // Dashboards
            this.logger.log(`Seeding Dashboards`);
            await this.seedDashboards(moduleMetadata, overallMetadata);

            // Scheduled Jobs
            this.logger.log(`Seeding Scheduled Jobs`);
            await this.seedScheduledJobs(moduleMetadata, overallMetadata);

            // Saved Filters
            this.logger.log(`Seeding Saved Filters`);
            await this.seedSavedFilters(moduleMetadata, overallMetadata);

            this.logger.debug(`[End] module seed data: ${overallMetadata}`);
        }

        // Setup default roles with permissions.
        await this.setupDefaultRolesWithPermissions();

        this.logger.log(`All Seeders finished`);

        //FIXME: Handle displaying the created users credentials in a better way.
        // this.logger.log(`Newly created username is: ${usersDetail?.length > 0 ? usersDetail[0]?.username : ''} and password is ${usersDetail?.length > 0 ? usersDetail[0]?.password : ''}`);
    }

    private async seedScheduledJobs(moduleMetadata: CreateModuleMetadataDto, overallMetadata: any) {
        this.logger.debug(`[Start] Processing scheduled jobs for ${moduleMetadata.name}`);
        const scheduledJobs: CreateScheduledJobDto[] = overallMetadata.scheduledJobs;
        if (scheduledJobs?.length > 0) {
            await this.handleSeedScheduledJobs(scheduledJobs);
        }
        this.logger.debug(`[End] Processing scheduled jobs for ${moduleMetadata.name}`);
    }

    private async seedSavedFilters(moduleMetadata: CreateModuleMetadataDto, overallMetadata: any) {
        this.logger.debug(`[Start] Processing saved filters for ${moduleMetadata.name}`);
        const savedFilters: CreateSavedFiltersDto[] = overallMetadata.savedFilters;
        if (savedFilters?.length > 0) {
            await this.handleSeedSavedFilters(savedFilters);
        }
        this.logger.debug(`[End] Processing saved filters for ${moduleMetadata.name}`);
    }

    private async seedDashboards(moduleMetadata: CreateModuleMetadataDto, overallMetadata: any) {
        this.logger.debug(`[Start] Processing dashboards for ${moduleMetadata.name}`);
        const dashboards: CreateDashboardDto[] = overallMetadata.dashboards;
        await this.handleSeedDashboards(dashboards);
        this.logger.debug(`[End] Processing dashboards for ${moduleMetadata.name}`);
    }

    private async seedListOfValues(moduleMetadata: CreateModuleMetadataDto, overallMetadata: any) {
        this.logger.debug(`[Start] Processing List Of Values for ${moduleMetadata.name}`);
        const listOfValues: CreateListOfValuesDto[] = overallMetadata.listOfValues;
        await this.handleSeedListOfValues(listOfValues);
        this.logger.debug(`[End] Processing List Of Values for ${moduleMetadata.name}`);
    }

    private async setupDefaultRolesWithPermissions() {
        this.logger.debug(`About to add all permissions to the Admin role`);
        await this.roleService.addAllPermissionsToRole(ADMIN_ROLE_NAME);
        // 2. Give  permissions to the Internal / Public role.
        this.logger.debug(`About to add all permissions to the Internal role`);
        await this.roleService.addPermissionToRole(INTERNAL_ROLE_NAME, INTERNAL_ROLE_PERMISSIONS);
        this.logger.debug(`About to add all permissions to the Public role`);
        await this.roleService.addPermissionToRole(PUBLIC_ROLE_NAME, ['SettingController.wrapSettings', 'AuthenticationController.logout']);
    }

    private async seedSecurityRules(overallMetadata: any) {
        this.logger.debug(`[Start] Processing security rules`);
        const securityRules: CreateSecurityRuleDto[] = overallMetadata.securityRules;
        await this.handleSeedSecurityRules(securityRules);
        this.logger.debug(`[End] Processing security rules`);
    }

    // Ok
    private async seedDefaultSettings() {
        this.logger.debug(`[Start] Processing settings`);
        await this.settingService.seedDefaultSettings();
        this.logger.debug(`[End] Processing settings`);
    }

    private async seedSmsTemplates(overallMetadata: any, moduleName: string) {
        this.logger.debug(`[Start] Processing sms templates`);
        const smsTemplates: CreateSmsTemplateDto[] = overallMetadata.smsTemplates;
        await this.handleSeedSmsTemplates(smsTemplates, moduleName);
        this.logger.debug(`[End] Processing sms templates`);
    }

    // OK
    private async seedEmailTemplates(overallMetadata: any, moduleName: string) {
        this.logger.debug(`[Start] Processing email templates`);
        const emailTemplates: CreateEmailTemplateDto[] = overallMetadata.emailTemplates;
        await this.handleSeedEmailTemplates(emailTemplates, moduleName);
        this.logger.debug(`[End] Processing email templates`);
    }

    // Ok
    private async seedMenus(overallMetadata: any) {
        this.logger.debug(`[Start] Processing menus`);
        const menus = overallMetadata.menus;
        await this.handleSeedMenus(menus);
        this.logger.debug(`[End] Processing menus`);
    }

    // Ok
    private async seedActions(overallMetadata: any) {
        this.logger.debug(`[Start] Processing actions`);
        const actions = overallMetadata.actions;
        await this.handleSeedActions(actions);
        this.logger.debug(`[End] Processing actions`);
    }

    // Ok
    private async seedViews(overallMetadata: any) {
        this.logger.debug(`[Start] Processing views`);
        const views = overallMetadata.views;
        await this.handleSeedViews(views);
        this.logger.debug(`[End] Processing views`);
    }

    // Ok
    private async seedUsers(overallMetadata: any) {
        this.logger.debug(`[Start] Processing users`);
        const users = overallMetadata.users;
        // usersDetail = users;
        await this.handleSeedUsers(users);
        this.logger.debug(`[End] Processing users`);
    }

    // OK
    private async seedRoles(overallMetadata: any) {
        this.logger.debug(`[Start] Processing roles`);
        // While creating roles we are only passing the role name to be used. 
        await this.roleService.createRolesIfNotExists(overallMetadata.roles.map(role => { return { name: role.name }; }));
        // After roles are created, we iterate over all roles and attach permissions (if specified in the seeder json) to the respective role.
        // Every role configuration in the seeder json can optionally have a permissions attribute. 
        for (const role of overallMetadata.roles) {
            if (role.permissions) {
                await this.roleService.addPermissionsToRole(role.name, role.permissions);
            }
        }
        this.logger.debug(`[End] Processing roles`);
    }

    // OK
    private get seedDataFiles(): any[] {
        const typedSolidCoreMetadata = structuredClone(solidCoreMetadata);
        const seedDataFiles = [typedSolidCoreMetadata];
        const enabledModules = getDynamicModuleNames();
        for (const enabledModule of enabledModules) {
            const enabledModuleSeedFile = `module-metadata/${enabledModule}/${enabledModule}-metadata.json`;
            const fullPath = path.join(process.cwd(), enabledModuleSeedFile);

            if (fs.existsSync(fullPath)) {
                const overallMetadata = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
                seedDataFiles.push(overallMetadata);
            }
        }

        return seedDataFiles;
    }

    // OK
    private async seedGlobalMetadata() {
        this.logger.log(`Seeding Permissions`);
        await this.seedPermissions();

        this.logger.log(`Seeding Default Media Storage Providers`);
        await this.seedDefaultMediaStorageProviders();

        this.logger.log(`Seeding System Fields Metadata`);
        await this.seedDefaultSystemFields();
    }

    private async seedDefaultSystemFields() {
        await this.systemFieldsSeederService.seed();
    }


    // OK
    private async seedPermissions() {

        const controllers = this.solidRegistry.getControllers();

        // Loop over the countries and create them.
        for (let id = 0; id < controllers.length; id++) {
            try {
                const controller = controllers[id];
                // this.logger.log(`Resolving controller: ${controller.name}`);

                const methods = controller.methods;
                for (let mId = 0; mId < methods.length; mId++) {

                    const methodName = methods[mId];
                    const permissionName = `${controller.name}.${methodName}`;

                    const existingPermission = await this.permissionRepo.findOne({
                        where: {
                            name: permissionName
                        }
                    });

                    // if (existingPermission) {
                    //     this.logger.log(`Permission ${permissionName} already exists.`);
                    // }
                    // else { }

                    if (!existingPermission) {

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

    // OK
    private async seedDefaultMediaStorageProviders() {
        await this.mediaStorageProviderSeederService.seed();
    }

    // OK
    private async seedMediaStorageProviders(mediaStorageProviders: any[]) {
        this.logger.debug(`[Start] Processing Media Storage Provider`);

        for (let i = 0; i < mediaStorageProviders.length; i++) {
            const mediaStorageProvider = mediaStorageProviders[i];
            await this.mediaStorageProviderMetadataService.upsert(mediaStorageProvider);
        }
        this.logger.debug(`[End] Processing Media Storage Provider`);
    }

    // OK
    private async handleSeedEmailTemplates(emailTemplates: CreateEmailTemplateDto[], moduleName: string) {
        if (!emailTemplates) {
            return;
        }

        for (let i = 0; i < emailTemplates.length; i++) {
            const emailTemplate = emailTemplates[i];
            // this.logger.log(`Found ${emailTemplate.name} email template`);

            // We need to load the actual template contents. 
            if (moduleName === 'solid-core') {
                const modulePath = path.dirname(require.resolve('@solidstarters/solid-core'));
                const seedDataPath = path.join(modulePath, '../src/seeders/seed-data/email-templates');
                const filePath = path.join(seedDataPath, emailTemplate.body);
                // this.logger.log(`Seeding email template from solid-core at path: ${filePath}`);
                if (fs.existsSync(filePath)) {
                    emailTemplate.body = fs.readFileSync(filePath, 'utf-8').toString();
                }
            }
            else {
                // Check if file exists
                const emailTemplateHandlebar = `module-metadata/${moduleName}/email-templates/${emailTemplate.body}`
                const fullPath = path.join(process.cwd(), emailTemplateHandlebar);
                // this.logger.log(`Seeding custom email template from consuming model at path: ${fullPath}`);
                if (fs.existsSync(fullPath)) {
                    emailTemplate.body = fs.readFileSync(fullPath, 'utf-8').toString();
                }
            }

            // Save to DB.
            await this.emailTemplateService.removeByName(emailTemplate.name);
            await this.emailTemplateService.create(emailTemplate);
        }

    }

    // Ok
    private async handleSeedSmsTemplates(smsTemplates: CreateSmsTemplateDto[], moduleName: string) {
        if (!smsTemplates) {
            return;
        }

        for (let i = 0; i < smsTemplates.length; i++) {
            const smsTemplate = smsTemplates[i];
            // this.logger.log(`Found ${smsTemplate.name} sms template`);

            // We need to load the actual template contents. 
            if (moduleName === 'solid-core') {
                const modulePath = path.dirname(require.resolve('@solidstarters/solid-core'));
                const seedDataPath = path.join(modulePath, '../src/seeders/seed-data/sms-templates');
                const filePath = path.join(seedDataPath, smsTemplate.body);
                // this.logger.log(`Seeding sms template from solid-core at path: ${filePath}`);
                if (fs.existsSync(filePath)) {
                    smsTemplate.body = fs.readFileSync(filePath, 'utf-8').toString();
                }
            }
            else {
                // Check if file exists
                const emailTemplateHandlebar = `module-metadata/${moduleName}/sms-templates/${smsTemplate.body}`
                const fullPath = path.join(process.cwd(), emailTemplateHandlebar);
                // this.logger.log(`Seeding custom sms template from consuming model at path: ${fullPath}`);
                if (fs.existsSync(fullPath)) {
                    smsTemplate.body = fs.readFileSync(fullPath, 'utf-8').toString();
                }
            }


            // Save to DB.
            await this.smsTemplateService.removeByName(smsTemplate.name);
            await this.smsTemplateService.create(smsTemplate);
        }
    }

    // Ok
    private async handleSeedMenus(menus: any) {
        if (!menus) {
            return;
        }

        await this.dataSource.transaction(async (trx) => {
            const menuRepo = trx.getRepository(MenuItemMetadata);
            const roleRepo = trx.getRepository(RoleMetadata);
            const actionRepo = trx.getRepository(ActionMetadata);
            const moduleRepo = trx.getRepository(ModuleMetadata);

            // 1) Upsert menus WITHOUT roles (manual upsert)
            for (const m of menus) {
                const action = m.actionUserKey
                    ? await actionRepo.findOne({ where: { name: m.actionUserKey }, select: ["id"] })
                    : null;

                const module = m.moduleUserKey
                    ? await moduleRepo.findOne({ where: { name: m.moduleUserKey }, select: ["id"] })
                    : null;

                const parentMenuItem = m.parentMenuItemUserKey
                    ? await menuRepo.findOne({ where: { name: m.parentMenuItemUserKey }, select: ["id"] })
                    : null;

                // Check if a menu with this name already exists
                const existing = await menuRepo.findOne({
                    where: { name: m.name },
                    select: ["id"],
                });

                // Build the entity data (without id)
                const base = {
                    name: m.name,
                    displayName: m.displayName,
                    action,
                    module,
                    parentMenuItem,
                };

                // If existing, set its id so save() will perform an update, otherwise insert
                const entity = menuRepo.create(
                    existing ? { id: existing.id, ...base } : base,
                );

                await menuRepo.save(entity);
            }

            // 2) Fetch ids for batching
            const seeded = await menuRepo.find({
                where: { name: In(menus.map((m: any) => m.name)) },
                select: ["id", "name"],
            });
            const idByName = new Map(seeded.map(s => [s.name, s.id]));

            // 3) Build desired join rows once
            const admin = await roleRepo.findOne({ where: { name: ADMIN_ROLE_NAME }, select: ["id", "name"] });
            const allRoleNames = new Set<string>();
            for (const m of menus) (m.roles ?? []).forEach((r: string) => allRoleNames.add(r));
            if (admin) allRoleNames.add(admin.name);

            const roles = await roleRepo.find({
                where: { name: In([...allRoleNames]) },
                select: ["id", "name"],
            });
            const roleByName = new Map(roles.map(r => [r.name, r]));

            const joinRows: Array<{ menuId: number; roleId: number }> = [];
            for (const m of menus) {
                const menuId = idByName.get(m.name)!;
                const roleNames = new Set<string>([...(m.roles ?? []), admin?.name].filter(Boolean) as string[]);
                for (const rn of roleNames) {
                    const role = roleByName.get(rn);
                    if (role) joinRows.push({ menuId, roleId: role.id });
                }
            }

            // 4) Replace in bulk — no orIgnore, safe for MSSQL
            // 4a) delete existing for affected menus
            const menuIds = [...new Set(joinRows.map(r => r.menuId))];
            if (menuIds.length) {
                await trx
                    .createQueryBuilder()
                    .delete()
                    .from(MENU_ROLE_JOIN_TABLE_NAME) // string table name is fine
                    .where(`${MENU_ROLE_JOIN_TABLE_NAME_MENU_COL} IN (:...ids)`, { ids: menuIds })
                    .execute();
            }

            // 4b) bulk insert all pairs
            if (joinRows.length) {
                const values = joinRows.map(r => ({
                    [MENU_ROLE_JOIN_TABLE_NAME_MENU_COL]: r.menuId,
                    [MENU_ROLE_JOIN_TABLE_NAME_ROLE_COL]: r.roleId,
                }));

                await trx
                    .createQueryBuilder()
                    .insert()
                    .into(MENU_ROLE_JOIN_TABLE_NAME)
                    .values(values)
                    // .orIgnore()  // ❌ remove this – it triggers unsupported onUpdate path
                    .execute();
            }
        });
    }

    // Ok
    private async handleSeedActions(actions: any) {
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

    // Ok
    private async handleSeedViews(views: any) {
        if (!views) {
            return;
        }

        for (let j = 0; j < views.length; j++) {
            const viewData = views[j];

            // preety format the layout & context. 
            viewData['layout'] = JSON.stringify(viewData['layout'], null, 2);

            viewData['module'] = await this.moduleMetadataService.findOneByUserKey(viewData.moduleUserKey);
            viewData['model'] = await this.modelMetadataService.findOneByUserKey(viewData.modelUserKey);

            // Changed the below to upsert as now we are saving modifications to the view json to file system also.
            await this.solidViewService.upsert(viewData);
        }
    }

    // OK
    private async handleSeedUsers(users) {
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
            //FIXME: Create the user roles assignment logic here.
            // now add Roles to user.
            // for (let m = 0; m < roles.length; m++) {
            //     const role = roles[m];
            //     await this.userService.addRoleToUser(user.email, role.name);
            // }
        }
    }

    // OK
    private async seedModuleModelFields(moduleMetadata: CreateModuleMetadataDto) {
        this.logger.debug(`[Start] Processing module metadata`);

        // First we create the module. 
        const module = await this.moduleMetadataService.upsert(moduleMetadata);

        // Next create all the models. 
        const modelsMetadata: CreateModelMetadataDto[] = moduleMetadata.models;
        for (let j = 0; j < modelsMetadata.length; j++) {
            const modelMetadata = modelsMetadata[j];

            // Before creating the model, we need to make sure we are linking it to the newly created module.
            modelMetadata['module'] = module;
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

                // Link model & mediaStorageProvider. 
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
        this.logger.debug(`[End] Processing module metadata`);
    }

    private async seedSettings(createDto: CreateSettingDto) {
        const settingsArray: any[] = await this.settingsRepo.find();
        if (!settingsArray || settingsArray.length === 0) {
            this.settingService.create(createDto);
        }
    }

    private async handleSeedSecurityRules(rulesDto: CreateSecurityRuleDto[]) {
        if (!rulesDto || rulesDto.length === 0) {
            this.logger.debug(`No security rules found to seed`);
            return;
        }
        for (const dto of rulesDto) {
            await this.securityRuleRepo.upsertWithDto({ ...dto, securityRuleConfig: JSON.stringify(dto.securityRuleConfig) });
        }
    }

    // Not Ok
    private async handleSeedListOfValues(listOfValuesDto: CreateListOfValuesDto[]) {
        if (!listOfValuesDto || listOfValuesDto.length === 0) {
            this.logger.debug(`No List Of Values found to seed`);
            return;
        }
        for (let j = 0; j < listOfValuesDto.length; j++) {
            const listOfValueDto = listOfValuesDto[j];
            listOfValueDto['module'] = await this.moduleMetadataService.findOneByUserKey(listOfValueDto.moduleUserKey);
            await this.listOfValuesService.upsert(listOfValuesDto[j]);
        }
    }

    private async handleSeedDashboards(dashboardDtos: CreateDashboardDto[]) {
        if (!dashboardDtos || dashboardDtos.length === 0) {
            this.logger.debug(`No dashboards found to seed`);
            return;
        }
        for (const dto of dashboardDtos) {
            await this.dashboardRepo.upsertWithDto(dto);
        }
    }

    private async handleSeedScheduledJobs(createScheduledJobDto: CreateScheduledJobDto[]) {
        if (!createScheduledJobDto || createScheduledJobDto.length === 0) {
            this.logger.debug(`No scheduled jobs found to seed`);
            return;
        }
        for (const dto of createScheduledJobDto) {
            await this.scheduledJobRepository.upsertWithDto(dto);
        }
    }

    private async handleSeedSavedFilters(createSavedFilterDto: CreateSavedFiltersDto[]) {
        if (!createSavedFilterDto || createSavedFilterDto.length === 0) {
            this.logger.debug(`No saved filters found to seed`);
            return;
        }
        for (const dto of createSavedFilterDto) {
            await this.savedFiltersRepo.upsertWithDto({ ...dto, filterQueryJson: JSON.stringify(dto.filterQueryJson) });
        }
    }

}