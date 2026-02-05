import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { CreateDashboardDto } from 'src/dtos/create-dashboard.dto';
import { CreateEmailTemplateDto } from 'src/dtos/create-email-template.dto';
import { CreateListOfValuesDto } from 'src/dtos/create-list-of-values.dto';
import { CreateSecurityRuleDto } from 'src/dtos/create-security-rule.dto';
import { CreateSmsTemplateDto } from 'src/dtos/create-sms-template.dto';
import { DashboardRepository } from 'src/repository/dashboard.repository';
import { SecurityRuleRepository } from 'src/repository/security-rule.repository';
import { AuthenticationService } from 'src/services/authentication.service';
import { EmailTemplateService } from 'src/services/email-template.service';
import { ListOfValuesService } from 'src/services/list-of-values.service';
import { SettingService } from 'src/services/setting.service';
import { SmsTemplateService } from 'src/services/sms-template.service';
import { UserService } from 'src/services/user.service';
import { DataSource, In } from 'typeorm';
import { CreateModelMetadataDto } from '../dtos/create-model-metadata.dto';
import { CreateModuleMetadataDto } from '../dtos/create-module-metadata.dto';
import { getDynamicModuleNamesBasedOnMetadata } from '../helpers/module.helper';
import { SolidRegistry } from '../helpers/solid-registry';
import { ActionMetadataService } from '../services/action-metadata.service';
import { FieldMetadataService } from '../services/field-metadata.service';
import { MediaStorageProviderMetadataService } from '../services/media-storage-provider-metadata.service';
import { ModelMetadataService } from '../services/model-metadata.service';
import { ModuleMetadataService } from '../services/module-metadata.service';
import { RoleMetadataService } from '../services/role-metadata.service';
import { ViewMetadataService } from '../services/view-metadata.service';
import solidCoreMetadata from './seed-data/solid-core-metadata.json';
import { SystemFieldsSeederService } from './system-fields-seeder.service';
// import { CreateScheduledJobDto } from 'src/dtos/create-scheduled-job.dto';
import { ActionMetadata, MENU_ROLE_JOIN_TABLE_NAME, MENU_ROLE_JOIN_TABLE_NAME_MENU_COL, MENU_ROLE_JOIN_TABLE_NAME_ROLE_COL, MenuItemMetadata, ModuleMetadata, RoleMetadata, SignUpDto } from 'src';
import { ADMIN_ROLE_NAME } from 'src/dtos/create-role-metadata.dto';
import { CreateSavedFiltersDto } from 'src/dtos/create-saved-filters.dto';
import { CreateScheduledJobDto } from 'src/dtos/create-scheduled-job.dto';
import { PermissionMetadataRepository } from 'src/repository/permission-metadata.repository';
import { SavedFiltersRepository } from 'src/repository/saved-filters.repository';
import { ScheduledJobRepository } from 'src/repository/scheduled-job.repository';
import { SettingRepository } from 'src/repository/setting.repository';
import { CreateModelSequenceDto } from 'src/dtos/create-model-sequence.dto';
import { ModelSequenceRepository } from 'src/repository/model-sequence.repository';
import { ModelSequence } from 'src/entities/model-sequence.entity';
import { SavedFilters } from 'src/entities/saved-filters.entity';
import { ScheduledJob } from 'src/entities/scheduled-job.entity';
import { SecurityRule } from 'src/entities/security-rule.entity';
import { ListOfValues } from 'src/entities/list-of-values.entity';
import { Dashboard } from 'src/entities/dashboard.entity';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { PermissionMetadata } from 'src/entities/permission-metadata.entity';
import { ViewMetadata } from 'src/entities/view-metadata.entity';


@Injectable()
export class ModuleMetadataSeederService {
    private readonly logger = new Logger(ModuleMetadataSeederService.name);
    private enablePruning: boolean = false;

    constructor(
        private readonly moduleMetadataService: ModuleMetadataService,
        @Inject(forwardRef(() => ModelMetadataService))
        private readonly modelMetadataService: ModelMetadataService,
        private readonly fieldMetadataService: FieldMetadataService,
        private readonly mediaStorageProviderMetadataService: MediaStorageProviderMetadataService,
        private readonly roleService: RoleMetadataService,
        private readonly userService: UserService,
        private readonly authenticationService: AuthenticationService,
        private readonly solidActionService: ActionMetadataService,
        private readonly solidViewService: ViewMetadataService,
        private readonly emailTemplateService: EmailTemplateService,
        private readonly smsTemplateService: SmsTemplateService,
        private readonly listOfValuesService: ListOfValuesService,
        // @InjectRepository(PermissionMetadata)
        // private readonly permissionRepo: Repository<PermissionMetadata>,
        private readonly permissionRepo: PermissionMetadataRepository,
        private readonly solidRegistry: SolidRegistry,
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
        readonly modelSequenceRepo: ModelSequenceRepository,
    ) { }

    async seed(conf?: any) {
        this.enablePruning = Boolean(conf?.pruneMetadata);
        console.log(this.enablePruning ? '▶ Pruning enabled: metadata not present in JSON will be removed.' : '▶ Pruning disabled: existing metadata will be kept.');

        // Global seeding steps i.e across all modules
        await this.seedGlobalMetadata();

        // Module specific seeding steps.
        // Get all the module metadata files which needs to be seeded.
        const seedDataFiles = this.seedDataFiles;
        this.logger.debug(`Found seed data for modules: ${seedDataFiles.map(s => s.moduleMetadata?.name)}`);

        /** 
         * -------------------------------------------------------------
         * Selective module seeding via: solid seed --modules-to-seed onboarding,reports 
         * -------------------------------------------------------------
         */
        let modulesToSeed: string[] | null = null;

        if (conf && Array.isArray(conf.modulesToSeed)) {
            modulesToSeed = conf.modulesToSeed;
            console.log(`▶ Selective seeding enabled. Modules to seed: ${modulesToSeed.join(', ')}`);
            this.logger.log(`Selective seeding enabled. Modules to seed: ${modulesToSeed.join(', ')}`);
        } else {
            console.log(`▶ No modulesToSeed provided. Seeding ALL modules.`);
            this.logger.log(`No modulesToSeed provided. Seeding ALL modules.`);
        }

        // Filter modules if needed
        const filteredSeedDataFiles = modulesToSeed ? seedDataFiles.filter((file) => modulesToSeed.includes(file.moduleMetadata?.name)) : seedDataFiles;

        if (filteredSeedDataFiles.length === 0) {
            this.logger.warn(`No modules matched the provided modulesToSeed list.`);
            return;
        }

        // let usersDetail;
        // For each module metadata file, we will process the seeding steps one by one.
        for (let i = 0; i < filteredSeedDataFiles.length; i++) {
            const overallMetadata = filteredSeedDataFiles[i];
            const moduleMetadata: CreateModuleMetadataDto = overallMetadata.moduleMetadata;
            console.log(`▶ Seeding Metadata for Module: ${moduleMetadata.name}`);
            this.logger.log(`Seeding Metadata for Module: ${moduleMetadata.name}`);

            // Process module metadata first. 
            this.logger.log(`Seeding Module / Model / Fields`);
            const moduleModelFieldCounts = await this.seedModuleModelFields(moduleMetadata);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Module/Model/Fields', moduleModelFieldCounts)}`);

            // Media Storage provider templates
            this.logger.log(`Seeding Media Storage Providers`);
            const mediaStorageCounts = await this.seedMediaStorageProviders(overallMetadata.mediaStorageProviders);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Media Storage Providers', mediaStorageCounts)}`);

            // Custom role handling
            this.logger.log(`Seeding Roles`);
            const roleCounts = await this.seedRoles(overallMetadata);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Roles', roleCounts)}`);

            // Custom user handling
            this.logger.log(`Seeding Users`);
            const userCounts = await this.seedUsers(overallMetadata);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Users', userCounts)}`);

            // Application Module View handling 
            this.logger.log(`Seeding Views`);
            const viewCounts = await this.seedViews(overallMetadata);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Views', viewCounts)}`);

            // Application Module Action handling
            this.logger.log(`Seeding Actions`);
            const actionCounts = await this.seedActions(overallMetadata);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Actions', actionCounts)}`);

            // Application Module Menu handling 
            this.logger.log(`Seeding Menus`);
            const menuCounts = await this.seedMenus(overallMetadata);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Menus', menuCounts)}`);

            // Email templates 
            this.logger.log(`Seeding Email Templates`);
            const emailTemplateCounts = await this.seedEmailTemplates(overallMetadata, moduleMetadata.name);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Email Templates', emailTemplateCounts)}`);

            // Sms templates
            this.logger.log(`Seeding Sms Templates`);
            const smsTemplateCounts = await this.seedSmsTemplates(overallMetadata, moduleMetadata.name);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Sms Templates', smsTemplateCounts)}`);

            // Security rules
            this.logger.log(`Seeding Security Rules`);
            const securityRuleCounts = await this.seedSecurityRules(overallMetadata);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Security Rules', securityRuleCounts)}`);

            // List Of Values
            this.logger.log(`Seeding List Of Values`);
            const lovCounts = await this.seedListOfValues(moduleMetadata, overallMetadata);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'List Of Values', lovCounts)}`);

            // Dashboards
            this.logger.log(`Seeding Dashboards`);
            const dashboardCounts = await this.seedDashboards(moduleMetadata, overallMetadata);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Dashboards', dashboardCounts)}`);

            // Scheduled Jobs
            this.logger.log(`Seeding Scheduled Jobs`);
            const scheduledJobCounts = await this.seedScheduledJobs(moduleMetadata, overallMetadata);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Scheduled Jobs', scheduledJobCounts)}`);

            // Saved Filters
            this.logger.log(`Seeding Saved Filters`);
            const savedFilterCounts = await this.seedSavedFilters(moduleMetadata, overallMetadata);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Saved Filters', savedFilterCounts)}`);

            // Model Sequences
            this.logger.log(`Seeding Model Sequences`);
            const modelSequenceCounts = await this.seedModelSequences(overallMetadata);
            console.log(`${this.formatSeedResult(moduleMetadata.name, 'Model Sequences', modelSequenceCounts)}`);
        }

        // Setup default roles with permissions.
        await this.setupDefaultRolesWithPermissions();

        // Add a console log indicating seeding is finished. This needs to be console.log so that it looks proper when this code is run via CLI.
        console.log(`✔ Seeding completed.`);
        //this.logger.log(`All Seeders finished`);

        //FIXME: Handle displaying the created users credentials in a better way.
        // this.logger.log(`Newly created username is: ${usersDetail?.length > 0 ? usersDetail[0]?.username : ''} and password is ${usersDetail?.length > 0 ? usersDetail[0]?.password : ''}`);
    }

    private async seedScheduledJobs(moduleMetadata: CreateModuleMetadataDto, overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing scheduled jobs for ${moduleMetadata.name}`);
        const scheduledJobs: CreateScheduledJobDto[] = overallMetadata.scheduledJobs;
        const pruned = this.enablePruning ? await this.pruneScheduledJobs(scheduledJobs, moduleMetadata.name) : 0;
        if (scheduledJobs?.length > 0) {
            await this.handleSeedScheduledJobs(scheduledJobs);
        }
        this.logger.debug(`[End] Processing scheduled jobs for ${moduleMetadata.name}`);
        return { pruned, upserted: scheduledJobs?.length ?? 0 };
    }

    private async seedSavedFilters(moduleMetadata: CreateModuleMetadataDto, overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing saved filters for ${moduleMetadata.name}`);
        const savedFilters: CreateSavedFiltersDto[] = overallMetadata.savedFilters;
        const pruned = this.enablePruning ? await this.pruneSavedFilters(savedFilters, moduleMetadata.name) : 0;
        if (savedFilters?.length > 0) {
            await this.handleSeedSavedFilters(savedFilters);
        }
        this.logger.debug(`[End] Processing saved filters for ${moduleMetadata.name}`);
        return { pruned, upserted: savedFilters?.length ?? 0 };
    }

    private async seedDashboards(moduleMetadata: CreateModuleMetadataDto, overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing dashboards for ${moduleMetadata.name}`);
        const dashboards: CreateDashboardDto[] = overallMetadata.dashboards;
        const pruned = this.enablePruning ? await this.pruneDashboards(dashboards, moduleMetadata.name) : 0;
        await this.handleSeedDashboards(dashboards);
        this.logger.debug(`[End] Processing dashboards for ${moduleMetadata.name}`);
        return { pruned, upserted: dashboards?.length ?? 0 };
    }

    private async seedListOfValues(moduleMetadata: CreateModuleMetadataDto, overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing List Of Values for ${moduleMetadata.name}`);
        const listOfValues: CreateListOfValuesDto[] = overallMetadata.listOfValues;
        const pruned = this.enablePruning ? await this.pruneListOfValues(listOfValues, moduleMetadata.name) : 0;
        await this.handleSeedListOfValues(listOfValues);
        this.logger.debug(`[End] Processing List Of Values for ${moduleMetadata.name}`);
        return { pruned, upserted: listOfValues?.length ?? 0 };
    }

    private async setupDefaultRolesWithPermissions() {
        this.logger.debug(`About to add all permissions to the Admin role`);
        await this.roleService.addAllPermissionsToRole(ADMIN_ROLE_NAME);

        // 2. Give  permissions to the Internal / Public role.
        // this.logger.debug(`About to add all permissions to the Internal role`);
        // await this.roleService.addPermissionToRole(INTERNAL_ROLE_NAME, INTERNAL_ROLE_PERMISSIONS);

        // this.logger.debug(`About to add all permissions to the Public role`);
        // await this.roleService.addPermissionToRole(PUBLIC_ROLE_NAME, ['SettingController.wrapSettings', 'AuthenticationController.logout']);
    }

    private async seedSecurityRules(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing security rules`);
        const securityRules: CreateSecurityRuleDto[] = overallMetadata.securityRules;
        const pruned = this.enablePruning ? await this.pruneSecurityRules(securityRules, overallMetadata?.moduleMetadata?.name) : 0;
        await this.handleSeedSecurityRules(securityRules);
        this.logger.debug(`[End] Processing security rules`);
        return { pruned, upserted: securityRules?.length ?? 0 };
    }

    // Ok
    private async seedDefaultSettings() {
        this.logger.debug(`[Start] Processing settings`);
        await this.settingService.seedSystemAdminEditableAndAboveSettings();
        this.logger.debug(`[End] Processing settings`);
    }

    private async seedSmsTemplates(overallMetadata: any, moduleName: string): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing sms templates`);
        const smsTemplates: CreateSmsTemplateDto[] = overallMetadata.smsTemplates;
        await this.handleSeedSmsTemplates(smsTemplates, moduleName);
        this.logger.debug(`[End] Processing sms templates`);
        return { pruned: 0, upserted: smsTemplates?.length ?? 0 };
    }

    // OK
    private async seedEmailTemplates(overallMetadata: any, moduleName: string): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing email templates`);
        const emailTemplates: CreateEmailTemplateDto[] = overallMetadata.emailTemplates;
        await this.handleSeedEmailTemplates(emailTemplates, moduleName);
        this.logger.debug(`[End] Processing email templates`);
        return { pruned: 0, upserted: emailTemplates?.length ?? 0 };
    }

    // Ok
    private async seedMenus(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing menus`);
        const menus = overallMetadata.menus;
        const pruned = this.enablePruning ? await this.pruneMenus(menus, overallMetadata?.moduleMetadata?.name) : 0;
        await this.handleSeedMenus(menus);
        this.logger.debug(`[End] Processing menus`);
        return { pruned, upserted: menus?.length ?? 0 };
    }

    // Ok
    private async seedActions(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing actions`);
        const actions = overallMetadata.actions;
        const pruned = this.enablePruning ? await this.pruneActions(actions, overallMetadata?.moduleMetadata?.name) : 0;
        await this.handleSeedActions(actions);
        this.logger.debug(`[End] Processing actions`);
        return { pruned, upserted: actions?.length ?? 0 };
    }

    // Ok
    private async seedViews(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing views`);
        const views = overallMetadata.views;
        const pruned = this.enablePruning ? await this.pruneViews(views, overallMetadata?.moduleMetadata?.name) : 0;
        await this.handleSeedViews(views);
        this.logger.debug(`[End] Processing views`);
        return { pruned, upserted: views?.length ?? 0 };
    }

    // Ok
    private async seedUsers(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing users`);
        const users = overallMetadata.users;
        // usersDetail = users;
        await this.handleSeedUsers(users);
        this.logger.debug(`[End] Processing users`);
        return { pruned: 0, upserted: users?.length ?? 0 };
    }

    // OK
    private async seedRoles(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
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
        return { pruned: 0, upserted: overallMetadata.roles?.length ?? 0 };
    }

    // OK
    private get seedDataFiles(): any[] {
        const typedSolidCoreMetadata = structuredClone(solidCoreMetadata);
        const seedDataFiles = [typedSolidCoreMetadata];
        // const enabledModules = getDynamicModuleNames();
        const enabledModules = getDynamicModuleNamesBasedOnMetadata();
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

        // this.logger.log(`Seeding Default Media Storage Providers`);
        // await this.seedDefaultMediaStorageProviders();

        this.logger.log(`Seeding System Fields Metadata`);
        await this.seedDefaultSystemFields();

        // Settings
        this.logger.log(`Seeding Default Settings`);
        await this.seedDefaultSettings();


        this.logger.debug(`Global metadata seeding completed`);
    }

    private async seedDefaultSystemFields() {
        await this.systemFieldsSeederService.seed();
    }


    // OK
    private async seedPermissions() {

        const controllers = this.solidRegistry.getControllers();
        const permissionNames: string[] = [];

        // Loop over the countries and create them.
        for (let id = 0; id < controllers.length; id++) {
            try {
                const controller = controllers[id];
                // this.logger.log(`Resolving controller: ${controller.name}`);

                const methods = controller.methods;
                for (let mId = 0; mId < methods.length; mId++) {

                    const methodName = methods[mId];
                    const permissionName = `${controller.name}.${methodName}`;
                    permissionNames.push(permissionName);

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

        if (this.enablePruning) {
            await this.prunePermissions(permissionNames);
        }
    }

    // OK
    // private async seedDefaultMediaStorageProviders() {
    //     await this.mediaStorageProviderSeederService.seed();
    // }

    // OK
    private async seedMediaStorageProviders(mediaStorageProviders: any[]): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing Media Storage Provider`);

        for (let i = 0; i < mediaStorageProviders.length; i++) {
            const mediaStorageProvider = mediaStorageProviders[i];
            await this.mediaStorageProviderMetadataService.upsert(mediaStorageProvider);
        }
        this.logger.debug(`[End] Processing Media Storage Provider`);
        return { pruned: 0, upserted: mediaStorageProviders?.length ?? 0 };
    }

    private async seedModelSequences(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing model sequences`);
        const modelSequences: CreateModelSequenceDto[] = overallMetadata.modelSequences;
        const pruned = this.enablePruning ? await this.pruneModelSequences(modelSequences, overallMetadata?.moduleMetadata?.name) : 0;
        await this.handleSeedModelSequences(modelSequences);
        this.logger.debug(`[End] Processing model sequences`);
        return { pruned, upserted: modelSequences?.length ?? 0 };
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
                let moduleRoot: string | null = null;

                try {
                    // Always resolve package.json, never the module entry
                    moduleRoot = path.dirname(
                        require.resolve('@solidx/solid-core/package.json'),
                    );
                } catch (err) {
                    this.logger.debug(
                        'Could not resolve @solidx/solid-core from node_modules, assuming local execution',
                    );
                }

                const filePathInternal = 'src/seeders/seed-data/email-templates/';
                let filePath: string;
                // Case 1: solid-core installed as dependency
                if (moduleRoot) {
                    filePath = path.join(
                        moduleRoot,
                        filePathInternal,
                        emailTemplate.body,
                    );
                }
                else {
                    // Case 2: running INSIDE solid-core repo
                    const localCoreRoot = process.cwd(); // or configurable root
                    filePath = path.join(
                        localCoreRoot,
                        filePathInternal,
                        emailTemplate.body,
                    );
                }

                if (fs.existsSync(filePath)) {
                    emailTemplate.body = fs.readFileSync(filePath, 'utf-8');
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
                let moduleRoot: string | null = null;

                try {
                    // Always resolve package.json, never the module entry
                    moduleRoot = path.dirname(
                        require.resolve('@solidx/solid-core/package.json'),
                    );
                } catch (err) {
                    this.logger.debug(
                        'Could not resolve @solidx/solid-core from node_modules, assuming local execution',
                    );
                }

                const filePathInternal = 'src/seeders/seed-data/sms-templates/';
                let filePath: string;
                // Case 1: solid-core installed as dependency
                if (moduleRoot) {
                    filePath = path.join(
                        moduleRoot,
                        filePathInternal,
                        smsTemplate.body,
                    );
                }
                else {
                    // Case 2: running INSIDE solid-core repo
                    const localCoreRoot = process.cwd(); // or configurable root
                    filePath = path.join(
                        localCoreRoot,
                        filePathInternal,
                        smsTemplate.body,
                    );
                }

                if (fs.existsSync(filePath)) {
                    smsTemplate.body = fs.readFileSync(filePath, 'utf-8');
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
                    sequenceNumber: m.sequenceNumber
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
            const user: SignUpDto = users[l];
            let exisitingUser = await this.userService.findOneByUsername(user.username);
            if (!exisitingUser) {
                let generatedAdminPassword: string | null = null;
                if (user.username === 'sa') {
                    generatedAdminPassword = uuidv4();
                    user.password = generatedAdminPassword;
                }

                exisitingUser = await this.authenticationService.signUp(user);
                this.logger.log(`Newly created user ${user.username}`);

                // Surface the generated SA password clearly to the operator.
                if (generatedAdminPassword) {
                    const banner = [
                        '',
                        '============================================================',
                        '  SYSTEM ADMIN USER CREATED',
                        '------------------------------------------------------------',
                        '  Username : sa',
                        `  Password : ${generatedAdminPassword}`,
                        '',
                        '  Copy and store this password securely now.',
                        '  It is shown only once during seeding.',
                        '============================================================',
                        ''
                    ].join('\n');
                    // Use console.log to ensure visibility even if logger formatting changes.
                    console.log(banner);
                }
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
    private async seedModuleModelFields(moduleMetadata: CreateModuleMetadataDto): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing module metadata`);

        // First we create the module. 
        const module = await this.moduleMetadataService.upsert(moduleMetadata);
        let pruned = 0;
        let upserted = 1;

        // Next create all the models. 
        const modelsMetadata: CreateModelMetadataDto[] = moduleMetadata.models;
        upserted += modelsMetadata?.length ?? 0;
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
            if (this.enablePruning) {
                pruned += await this.pruneFieldsForModel(model, fieldsMetadata);
            }
            let userKeyField = null;
            const userKeyFieldName = modelMetadata.userKeyFieldUserKey;
            upserted += fieldsMetadata?.length ?? 0;
            for (let k = 0; k < fieldsMetadata.length; k++) {
                const fieldMetadata = fieldsMetadata[k];

                // Link model & mediaStorageProvider. 
                fieldMetadata['model'] = model;
                if (fieldMetadata.mediaStorageProviderUserKey) {
                    fieldMetadata['mediaStorageProvider'] = await this.mediaStorageProviderMetadataService.findOneByUserKey(fieldMetadata.mediaStorageProviderUserKey);
                }
                // console.log(fieldMetadata.displayName);

                const affectedField = await this.fieldMetadataService.upsert(fieldMetadata);
                if (fieldMetadata.name === userKeyFieldName || fieldMetadata.isUserKey) {
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
        if (this.enablePruning) {
            pruned += await this.pruneModels(modelsMetadata, moduleMetadata.name);
        }
        this.logger.debug(`[End] Processing module metadata`);
        return { pruned, upserted };
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

    private async handleSeedModelSequences(modelSequencesDto: CreateModelSequenceDto[]) {
        if (!modelSequencesDto || modelSequencesDto.length === 0) {
            this.logger.debug(`No Model Sequences found to seed`);
            return;
        }
        for (const dto of modelSequencesDto) {
            await this.modelSequenceRepo.upsertWithDto(dto);
        }
    }

    private async pruneModelSequences(modelSequencesDto: CreateModelSequenceDto[] | undefined, moduleName?: string): Promise<number> {
        if (!moduleName) {
            this.logger.warn(`Skipping model sequence prune: missing module name in metadata.`);
            return 0;
        }
        const sequences = modelSequencesDto ?? [];

        const module = await this.moduleMetadataService.findOneByUserKey(moduleName);
        if (!module) {
            this.logger.warn(`Skipping model sequence prune: module not found for ${moduleName}.`);
            return 0;
        }

        const sequenceNames = [...new Set(sequences.map(dto => dto.sequenceName).filter(Boolean))];
        const repo = this.dataSource.getRepository(ModelSequence);
        const idsToDeleteQuery = repo
            .createQueryBuilder('ms')
            .select('ms.id', 'id')
            .innerJoin('ms.module', 'module')
            .where('module.id = :moduleId', { moduleId: module.id });

        if (sequenceNames.length > 0) {
            idsToDeleteQuery.andWhere('ms.sequenceName NOT IN (:...sequenceNames)', { sequenceNames });
        }

        const rows = await idsToDeleteQuery.getRawMany();
        const ids = rows.map((row) => row.id);
        if (ids.length > 0) {
            const result = await repo
                .createQueryBuilder()
                .delete()
                .from(ModelSequence)
                .whereInIds(ids)
                .execute();
            return result.affected ?? 0;
        }
        return 0;
    }

    private async pruneSavedFilters(savedFiltersDto: CreateSavedFiltersDto[] | undefined, moduleName?: string): Promise<number> {
        if (!moduleName) {
            this.logger.warn(`Skipping saved filters prune: missing module name in metadata.`);
            return 0;
        }
        const savedFilters = savedFiltersDto ?? [];

        const module = await this.moduleMetadataService.findOneByUserKey(moduleName);
        if (!module) {
            this.logger.warn(`Skipping saved filters prune: module not found for ${moduleName}.`);
            return 0;
        }

        const filterNames = [...new Set(savedFilters.map(dto => dto.name).filter(Boolean))];
        const repo = this.dataSource.getRepository(SavedFilters);
        const idsToDeleteQuery = repo
            .createQueryBuilder('sf')
            .select('sf.id', 'id')
            .innerJoin('sf.view', 'view')
            .innerJoin('view.module', 'module')
            .where('module.id = :moduleId', { moduleId: module.id });

        if (filterNames.length > 0) {
            idsToDeleteQuery.andWhere('sf.name NOT IN (:...filterNames)', { filterNames });
        }

        const rows = await idsToDeleteQuery.getRawMany();
        const ids = rows.map((row) => row.id);
        if (ids.length > 0) {
            const result = await repo
                .createQueryBuilder()
                .delete()
                .from(SavedFilters)
                .whereInIds(ids)
                .execute();
            return result.affected ?? 0;
        }
        return 0;
    }

    private async pruneScheduledJobs(scheduledJobsDto: CreateScheduledJobDto[] | undefined, moduleName?: string): Promise<number> {
        if (!moduleName) {
            this.logger.warn(`Skipping scheduled jobs prune: missing module name in metadata.`);
            return 0;
        }
        const scheduledJobs = scheduledJobsDto ?? [];

        const module = await this.moduleMetadataService.findOneByUserKey(moduleName);
        if (!module) {
            this.logger.warn(`Skipping scheduled jobs prune: module not found for ${moduleName}.`);
            return 0;
        }

        const scheduleNames = [...new Set(scheduledJobs.map(dto => dto.scheduleName).filter(Boolean))];
        const repo = this.dataSource.getRepository(ScheduledJob);
        const idsToDeleteQuery = repo
            .createQueryBuilder('sj')
            .select('sj.id', 'id')
            .innerJoin('sj.module', 'module')
            .where('module.id = :moduleId', { moduleId: module.id });

        if (scheduleNames.length > 0) {
            idsToDeleteQuery.andWhere('sj.scheduleName NOT IN (:...scheduleNames)', { scheduleNames });
        }

        const rows = await idsToDeleteQuery.getRawMany();
        const ids = rows.map((row) => row.id);
        if (ids.length > 0) {
            const result = await repo
                .createQueryBuilder()
                .delete()
                .from(ScheduledJob)
                .whereInIds(ids)
                .execute();
            return result.affected ?? 0;
        }
        return 0;
    }

    private async pruneSecurityRules(securityRulesDto: CreateSecurityRuleDto[] | undefined, moduleName?: string): Promise<number> {
        if (!moduleName) {
            this.logger.warn(`Skipping security rules prune: missing module name in metadata.`);
            return 0;
        }
        const securityRules = securityRulesDto ?? [];

        const module = await this.moduleMetadataService.findOneByUserKey(moduleName);
        if (!module) {
            this.logger.warn(`Skipping security rules prune: module not found for ${moduleName}.`);
            return 0;
        }

        const ruleNames = [...new Set(securityRules.map(dto => dto.name).filter(Boolean))];
        const repo = this.dataSource.getRepository(SecurityRule);
        const idsToDeleteQuery = repo
            .createQueryBuilder('sr')
            .select('sr.id', 'id')
            .innerJoin('sr.modelMetadata', 'model')
            .innerJoin('model.module', 'module')
            .where('module.id = :moduleId', { moduleId: module.id });

        if (ruleNames.length > 0) {
            idsToDeleteQuery.andWhere('sr.name NOT IN (:...ruleNames)', { ruleNames });
        }

        const rows = await idsToDeleteQuery.getRawMany();
        const ids = rows.map((row) => row.id);
        if (ids.length > 0) {
            const result = await repo
                .createQueryBuilder()
                .delete()
                .from(SecurityRule)
                .whereInIds(ids)
                .execute();
            return result.affected ?? 0;
        }
        return 0;
    }

    private async pruneListOfValues(listOfValuesDto: CreateListOfValuesDto[] | undefined, moduleName?: string): Promise<number> {
        if (!moduleName) {
            this.logger.warn(`Skipping list of values prune: missing module name in metadata.`);
            return 0;
        }
        const listOfValues = listOfValuesDto ?? [];

        const module = await this.moduleMetadataService.findOneByUserKey(moduleName);
        if (!module) {
            this.logger.warn(`Skipping list of values prune: module not found for ${moduleName}.`);
            return 0;
        }

        const pairs = listOfValues
            .filter(dto => dto.type && dto.value)
            .map(dto => ({ type: dto.type, value: dto.value }));
        const repo = this.dataSource.getRepository(ListOfValues);
        const idsToDeleteQuery = repo
            .createQueryBuilder('lov')
            .select('lov.id', 'id')
            .innerJoin('lov.module', 'module')
            .where('module.id = :moduleId', { moduleId: module.id });

        if (pairs.length > 0) {
            const conditions = pairs.map((_, i) => `(lov.type = :t${i} AND lov.value = :v${i})`).join(' OR ');
            const params = pairs.reduce((acc, pair, i) => {
                acc[`t${i}`] = pair.type;
                acc[`v${i}`] = pair.value;
                return acc;
            }, {} as Record<string, string>);

            idsToDeleteQuery.andWhere(`NOT (${conditions})`, params);
        }

        const rows = await idsToDeleteQuery.getRawMany();
        const ids = rows.map((row) => row.id);
        if (ids.length > 0) {
            const result = await repo
                .createQueryBuilder()
                .delete()
                .from(ListOfValues)
                .whereInIds(ids)
                .execute();
            return result.affected ?? 0;
        }
        return 0;
    }

    private async pruneDashboards(dashboardsDto: CreateDashboardDto[] | undefined, moduleName?: string): Promise<number> {
        if (!moduleName) {
            this.logger.warn(`Skipping dashboards prune: missing module name in metadata.`);
            return 0;
        }
        const dashboards = dashboardsDto ?? [];

        const module = await this.moduleMetadataService.findOneByUserKey(moduleName);
        if (!module) {
            this.logger.warn(`Skipping dashboards prune: module not found for ${moduleName}.`);
            return 0;
        }

        const dashboardNames = [...new Set(dashboards.map(dto => dto.name).filter(Boolean))];
        const repo = this.dataSource.getRepository(Dashboard);
        const idsToDeleteQuery = repo
            .createQueryBuilder('db')
            .select('db.id', 'id')
            .innerJoin('db.module', 'module')
            .where('module.id = :moduleId', { moduleId: module.id });

        if (dashboardNames.length > 0) {
            idsToDeleteQuery.andWhere('db.name NOT IN (:...dashboardNames)', { dashboardNames });
        }

        const rows = await idsToDeleteQuery.getRawMany();
        const ids = rows.map((row) => row.id);
        if (ids.length > 0) {
            const result = await repo
                .createQueryBuilder()
                .delete()
                .from(Dashboard)
                .whereInIds(ids)
                .execute();
            return result.affected ?? 0;
        }
        return 0;
    }

    private async pruneMenus(menusDto: any[] | undefined, moduleName?: string): Promise<number> {
        if (!moduleName) {
            this.logger.warn(`Skipping menus prune: missing module name in metadata.`);
            return 0;
        }
        const menus = menusDto ?? [];

        const module = await this.moduleMetadataService.findOneByUserKey(moduleName);
        if (!module) {
            this.logger.warn(`Skipping menus prune: module not found for ${moduleName}.`);
            return 0;
        }

        const menuNames = [...new Set(menus.map(m => m.name).filter(Boolean))];
        const repo = this.dataSource.getRepository(MenuItemMetadata);
        const idsToDeleteQuery = repo
            .createQueryBuilder('menu')
            .select('menu.id', 'id')
            .innerJoin('menu.module', 'module')
            .where('module.id = :moduleId', { moduleId: module.id });

        if (menuNames.length > 0) {
            idsToDeleteQuery.andWhere('menu.name NOT IN (:...menuNames)', { menuNames });
        }

        const rows = await idsToDeleteQuery.getRawMany();
        const ids = rows.map((row) => row.id);
        if (ids.length > 0) {
            await this.dataSource
                .createQueryBuilder()
                .delete()
                .from(MENU_ROLE_JOIN_TABLE_NAME)
                .where(`${MENU_ROLE_JOIN_TABLE_NAME_MENU_COL} IN (:...ids)`, { ids })
                .execute();
        }
        if (ids.length > 0) {
            const result = await repo
                .createQueryBuilder()
                .delete()
                .from(MenuItemMetadata)
                .whereInIds(ids)
                .execute();
            return result.affected ?? 0;
        }
        return 0;
    }

    private async pruneViews(viewsDto: any[] | undefined, moduleName?: string): Promise<number> {
        if (!moduleName) {
            this.logger.warn(`Skipping views prune: missing module name in metadata.`);
            return 0;
        }
        const views = viewsDto ?? [];

        const module = await this.moduleMetadataService.findOneByUserKey(moduleName);
        if (!module) {
            this.logger.warn(`Skipping views prune: module not found for ${moduleName}.`);
            return 0;
        }

        const viewNames = [...new Set(views.map((v: any) => v.name).filter(Boolean))];
        const repo = this.dataSource.getRepository(ViewMetadata);
        const idsToDeleteQuery = repo
            .createQueryBuilder('view')
            .select('view.id', 'id')
            .innerJoin('view.module', 'module')
            .where('module.id = :moduleId', { moduleId: module.id });

        if (viewNames.length > 0) {
            idsToDeleteQuery.andWhere('view.name NOT IN (:...viewNames)', { viewNames });
        }

        const rows = await idsToDeleteQuery.getRawMany();
        const ids = rows.map((row) => row.id);
        if (ids.length > 0) {
            // Delete actions tied to these views before deleting the views themselves.
            const actionRepo = this.dataSource.getRepository(ActionMetadata);
            const actionRows = await actionRepo
                .createQueryBuilder('action')
                .select('action.id', 'id')
                .innerJoin('action.view', 'view')
                .where('view.id IN (:...viewIds)', { viewIds: ids })
                .getRawMany();
            const actionIds = actionRows.map((row) => row.id);
            if (actionIds.length > 0) {
                const result = await actionRepo
                    .createQueryBuilder()
                    .delete()
                    .from(ActionMetadata)
                    .whereInIds(actionIds)
                    .execute();
                if ((result.affected ?? 0) === 0) {
                    this.logger.warn(`No actions deleted for pruned views in module ${moduleName}.`);
                }
            }

            const result = await repo
                .createQueryBuilder()
                .delete()
                .from(ViewMetadata)
                .whereInIds(ids)
                .execute();
            return result.affected ?? 0;
        }
        return 0;
    }

    private async pruneActions(actionsDto: any[] | undefined, moduleName?: string): Promise<number> {
        if (!moduleName) {
            this.logger.warn(`Skipping actions prune: missing module name in metadata.`);
            return 0;
        }
        const actions = actionsDto ?? [];

        const module = await this.moduleMetadataService.findOneByUserKey(moduleName);
        if (!module) {
            this.logger.warn(`Skipping actions prune: module not found for ${moduleName}.`);
            return 0;
        }

        const actionNames = [...new Set(actions.map((a: any) => a.name).filter(Boolean))];
        const repo = this.dataSource.getRepository(ActionMetadata);
        const idsToDeleteQuery = repo
            .createQueryBuilder('action')
            .select('action.id', 'id')
            .innerJoin('action.module', 'module')
            .where('module.id = :moduleId', { moduleId: module.id });

        if (actionNames.length > 0) {
            idsToDeleteQuery.andWhere('action.name NOT IN (:...actionNames)', { actionNames });
        }

        const rows = await idsToDeleteQuery.getRawMany();
        const ids = rows.map((row) => row.id);
        if (ids.length > 0) {
            const menuRepo = this.dataSource.getRepository(MenuItemMetadata);
            const menuRows = await menuRepo
                .createQueryBuilder('menu')
                .select('menu.id', 'id')
                .innerJoin('menu.action', 'action')
                .where('action.id IN (:...actionIds)', { actionIds: ids })
                .getRawMany();
            const menuIds = menuRows.map((row) => row.id);

            if (menuIds.length > 0) {
                await this.dataSource
                    .createQueryBuilder()
                    .delete()
                    .from(MENU_ROLE_JOIN_TABLE_NAME)
                    .where(`${MENU_ROLE_JOIN_TABLE_NAME_MENU_COL} IN (:...ids)`, { ids: menuIds })
                    .execute();

                await menuRepo
                    .createQueryBuilder()
                    .delete()
                    .from(MenuItemMetadata)
                    .whereInIds(menuIds)
                    .execute();
            }

            const result = await repo
                .createQueryBuilder()
                .delete()
                .from(ActionMetadata)
                .whereInIds(ids)
                .execute();
            return result.affected ?? 0;
        }
        return 0;
    }

    private async pruneFieldsForModel(model: any, fieldsMetadata: any[] | undefined): Promise<number> {
        if (!model) {
            this.logger.warn(`Skipping fields prune: model not found.`);
            return 0;
        }
        const fields = fieldsMetadata ?? [];

        const fieldNames = [...new Set(fields.map(f => f.name).filter(Boolean))];
        const repo = this.dataSource.getRepository(FieldMetadata);
        const idsToDeleteQuery = repo
            .createQueryBuilder('field')
            .select('field.id', 'id')
            .innerJoin('field.model', 'model')
            .where('model.id = :modelId', { modelId: model.id })
            .andWhere('field.isSystem = :isSystem', { isSystem: false });

        if (fieldNames.length > 0) {
            idsToDeleteQuery.andWhere('field.name NOT IN (:...fieldNames)', { fieldNames });
        }

        const rows = await idsToDeleteQuery.getRawMany();
        const ids = rows.map((row) => row.id);
        if (ids.length > 0) {
            const result = await repo
                .createQueryBuilder()
                .delete()
                .from(FieldMetadata)
                .whereInIds(ids)
                .execute();
            return result.affected ?? 0;
        }
        return 0;
    }

    private async pruneModels(modelsMetadata: CreateModelMetadataDto[] | undefined, moduleName?: string): Promise<number> {
        if (!moduleName) {
            this.logger.warn(`Skipping models prune: missing module name in metadata.`);
            return 0;
        }
        const models = modelsMetadata ?? [];

        const module = await this.moduleMetadataService.findOneByUserKey(moduleName);
        if (!module) {
            this.logger.warn(`Skipping models prune: module not found for ${moduleName}.`);
            return 0;
        }

        const modelNames = [...new Set(models.map(m => m.singularName).filter(Boolean))];
        const repo = this.dataSource.getRepository(ModelMetadata);
        const idsToDeleteQuery = repo
            .createQueryBuilder('model')
            .select('model.id', 'id')
            .innerJoin('model.module', 'module')
            .where('module.id = :moduleId', { moduleId: module.id })
            .andWhere('model.isSystem = :isSystem', { isSystem: false });

        if (modelNames.length > 0) {
            idsToDeleteQuery.andWhere('model.singularName NOT IN (:...modelNames)', { modelNames });
        }

        const rows = await idsToDeleteQuery.getRawMany();
        const ids = rows.map((row) => row.id);
        if (ids.length > 0) {
            const result = await repo
                .createQueryBuilder()
                .delete()
                .from(ModelMetadata)
                .whereInIds(ids)
                .execute();
            return result.affected ?? 0;
        }
        return 0;
    }

    private getRolePermissionJoinInfo(): { tableName: string; permissionIdColumn: string } | null {
        const roleMetadata = this.dataSource.getMetadata(RoleMetadata);
        const relation = roleMetadata.relations.find((r) => r.propertyName === 'permissions');
        if (!relation || !relation.junctionEntityMetadata) {
            this.logger.warn(`Role-permission join table metadata not found; skipping join cleanup.`);
            return null;
        }

        const permissionIdColumn = relation.inverseJoinColumns[0]?.databaseName;
        if (!permissionIdColumn) {
            this.logger.warn(`Role-permission join column not found; skipping join cleanup.`);
            return null;
        }

        return {
            tableName: relation.junctionEntityMetadata.tableName,
            permissionIdColumn,
        };
    }

    private async prunePermissions(permissionNames: string[]): Promise<number> {
        const uniqueNames = [...new Set(permissionNames.filter(Boolean))];
        const repo = this.dataSource.getRepository(PermissionMetadata);
        const idsToDeleteQuery = repo
            .createQueryBuilder('perm')
            .select('perm.id', 'id');

        if (uniqueNames.length > 0) {
            idsToDeleteQuery.andWhere('perm.name NOT IN (:...names)', { names: uniqueNames });
        }

        const rows = await idsToDeleteQuery.getRawMany();
        const ids = rows.map((row) => row.id);
        // Commented out to allow pruning when metadata is empty/missing.
        // if (ids.length === 0) {
        //     return;
        // }

        const joinInfo = this.getRolePermissionJoinInfo();
        if (joinInfo && ids.length > 0) {
            await this.dataSource
                .createQueryBuilder()
                .delete()
                .from(joinInfo.tableName)
                .where(`${joinInfo.permissionIdColumn} IN (:...ids)`, { ids })
                .execute();
        }

        if (ids.length > 0) {
            const result = await repo
                .createQueryBuilder()
                .delete()
                .from(PermissionMetadata)
                .whereInIds(ids)
                .execute();
            return result.affected ?? 0;
        }
        return 0;
    }

    // private async resolvePruningChoice(conf?: any): Promise<boolean> {
    //     if (typeof conf?.pruneMetadata === 'boolean') {
    //         return conf.pruneMetadata;
    //     }
    //     if (!process.stdin.isTTY) {
    //         return false;
    //     }

    //     const rl = readline.createInterface({
    //         input: process.stdin,
    //         output: process.stdout,
    //     });

    //     const question = `Prune metadata entries not in JSON? (y/N) `;
    //     const answer: string = await new Promise((resolve) => {
    //         rl.question(question, (input) => resolve(input));
    //     });
    //     rl.close();

    //     return answer.trim().toLowerCase().startsWith('y');
    // }

    private formatSeedResult(moduleName: string, label: string, counts: { pruned: number; upserted: number }): string {
        if (this.enablePruning) {
            return `✔ [${moduleName}] ${label} seeded (pruned ${counts.pruned}, upserted ${counts.upserted})`;
        }
        return `✔ [${moduleName}] ${label} seeded (upserted ${counts.upserted})`;
    }

}
