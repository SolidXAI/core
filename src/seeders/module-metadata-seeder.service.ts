import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { CreateEmailTemplateDto } from 'src/dtos/create-email-template.dto';
import { CreateListOfValuesDto } from 'src/dtos/create-list-of-values.dto';
import { CreateSecurityRuleDto } from 'src/dtos/create-security-rule.dto';
import { CreateSmsTemplateDto } from 'src/dtos/create-sms-template.dto';
import { SecurityRuleRepository } from 'src/repository/security-rule.repository';
import { AuthenticationService } from 'src/services/authentication.service';
import { EmailTemplateService } from 'src/services/email-template.service';
import { ListOfValuesService } from 'src/services/list-of-values.service';
import { SettingService } from 'src/services/setting.service';
import { SmsTemplateService } from 'src/services/sms-template.service';
import { UserService } from 'src/services/user.service';
import { DataSource, In, Repository } from 'typeorm';
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
import { ActionMetadata } from '../entities/action-metadata.entity';
import { MenuItemMetadata } from '../entities/menu-item-metadata.entity';
import { ModuleMetadata } from '../entities/module-metadata.entity';
import { RoleMetadata } from '../entities/role-metadata.entity';
import { MENU_ROLE_JOIN_TABLE_NAME, MENU_ROLE_JOIN_TABLE_NAME_MENU_COL, MENU_ROLE_JOIN_TABLE_NAME_ROLE_COL } from '../dtos/create-menu-item-metadata.dto';
import { DEFAULT_SA_PASSWORD } from '../dtos/create-user.dto';
import { SignUpDto } from '../dtos/sign-up.dto';
import { ADMIN_ROLE_NAME, CreateRoleMetadataDto } from 'src/dtos/create-role-metadata.dto';
import { CreateSavedFiltersDto } from 'src/dtos/create-saved-filters.dto';
import { CreateScheduledJobDto } from 'src/dtos/create-scheduled-job.dto';
import { CreateLocaleDto } from 'src/dtos/create-locale.dto';
import { PermissionMetadataRepository } from 'src/repository/permission-metadata.repository';
import { SavedFiltersRepository } from 'src/repository/saved-filters.repository';
import { ScheduledJobRepository } from 'src/repository/scheduled-job.repository';
import { SettingRepository } from 'src/repository/setting.repository';
import { CreateModelSequenceDto } from 'src/dtos/create-model-sequence.dto';
import { ModelSequenceRepository } from 'src/repository/model-sequence.repository';
import { LocaleRepository } from 'src/repository/locale.repository';
import { ModelSequence } from 'src/entities/model-sequence.entity';
import { SavedFilters } from 'src/entities/saved-filters.entity';
import { ScheduledJob } from 'src/entities/scheduled-job.entity';
import { SecurityRule } from 'src/entities/security-rule.entity';
import { ListOfValues } from 'src/entities/list-of-values.entity';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { PermissionMetadata } from 'src/entities/permission-metadata.entity';
import { ViewMetadata } from 'src/entities/view-metadata.entity';

/**
 * Central metadata seeder for both solid-core and consuming modules.
 *
 * Performance notes:
 * - This file now contains the main seed-time optimizations that were added after profiling real FRMS seed runs.
 * - The goal of those changes was to preserve existing behavior while removing avoidable serial database work.
 * - Verbose timing logs are intentionally emitted through Nest logger `debug()` only, so normal CLI runs stay clean.
 * - Every timing line is tagged with `[SEED_TIMING]` and a stable `[ITEM:...]` identifier for grep-friendly analysis.
 *
 * High-impact optimizations currently implemented here:
 * - Batched permission preload/insert, with case-insensitive dedupe to match MSSQL collation behavior.
 * - Process-local lookup caches for module/model/view/provider reads during a single seed run.
 * - Model-level field preload/diff to avoid field-level serial existence checks.
 * - View/action preload + in-memory no-op detection so unchanged rows skip save() entirely.
 * - Menu entity no-op detection, though menu relation lookups are still mostly serial and remain a future candidate.
 */
@Injectable()
export class ModuleMetadataSeederService {
    private readonly logger = new Logger(ModuleMetadataSeederService.name);
    // Stable tag used on all verbose seed timing logs so runs can be grepped quickly.
    private readonly seedTimingTag = 'SEED_TIMING';
    // Keep permission batching bounded while still collapsing thousands of serial checks into a few queries.
    private readonly permissionSeedBatchSize = 500;
    // Restrict no-op detection to the fields that actually matter for persistence.
    private readonly viewComparableFields = ['name', 'displayName', 'type', 'context', 'layout', 'module', 'model'] as const;
    private readonly actionComparableFields = ['name', 'displayName', 'type', 'domain', 'context', 'customComponent', 'customIsModal', 'serverEndpoint', 'module', 'model', 'view'] as const;
    // These caches are intentionally process-local and are reset at the beginning of every seed run.
    private readonly moduleLookupCache = new Map<string, ModuleMetadata | null>();
    private readonly modelLookupCache = new Map<string, ModelMetadata | null>();
    private readonly viewLookupCache = new Map<string, ViewMetadata | null>();
    private readonly mediaStorageProviderLookupCache = new Map<string, any | null>();
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
        readonly scheduledJobRepository: ScheduledJobRepository,
        readonly savedFiltersRepo: SavedFiltersRepository,
        readonly dataSource: DataSource,
        readonly modelSequenceRepo: ModelSequenceRepository,
        readonly localeRepo: LocaleRepository,
    ) { }

    async seed(conf?: any) {
        let currentModule = 'global';
        let currentStep = 'bootstrap';
        let modulesToSeed: string[] | null = null;
        const shouldSeedGlobalMetadata = conf?.seedGlobalMetadata !== false;

        try {
            this.enablePruning = Boolean(conf?.pruneMetadata);
            // Never reuse cached entity snapshots across seed invocations in the same process.
            this.resetLookupCaches();
            console.log(this.enablePruning ? '▶ Pruning enabled: metadata not present in JSON will be removed.' : '▶ Pruning disabled: existing metadata will be kept.');

            await this.timeOperation('seed-run', async () => {
                // Global seeding steps i.e across all modules
                if (shouldSeedGlobalMetadata) {
                    currentStep = 'seedGlobalMetadata';
                    await this.timeOperation('global-seed', () => this.seedGlobalMetadata(), { moduleName: 'global', component: 'global-metadata' });
                } else {
                    this.logger.log(`Skipping global metadata seeding.`);
                }

                // Module specific seeding steps.
                // Get all the module metadata files which needs to be seeded.
                const seedDataFiles = this.seedDataFiles;
                this.logger.debug(`Found seed data for modules: ${seedDataFiles.map(s => s.moduleMetadata?.name)}`);

                /**
                 * -------------------------------------------------------------
                 * Selective module seeding via: solid seed --modules-to-seed onboarding,reports
                 * -------------------------------------------------------------
                 */
                currentStep = 'resolveModulesToSeed';
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
                    currentModule = moduleMetadata?.name ?? 'unknown';

                    if (!moduleMetadata?.name) {
                        this.logger.warn(`Skipping seed metadata file because moduleMetadata.name is missing.`);
                        continue;
                    }

                    console.log(`▶ Seeding Metadata for Module: ${moduleMetadata.name}`);
                    this.logger.log(`Seeding Metadata for Module: ${moduleMetadata.name}`);

                    await this.timeOperation('module-total', async () => {
                        currentStep = 'seedMediaStorageProviders';
                        this.logger.log(`Seeding Media Storage Providers`);
                        const mediaStorageCounts = await this.timeOperation('seed-media-storage-providers', () => this.seedMediaStorageProviders(overallMetadata.mediaStorageProviders), { moduleName: moduleMetadata.name, component: 'media-storage-providers' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Media Storage Providers', mediaStorageCounts)}`);

                        // Process module metadata first.
                        currentStep = 'seedModuleModelFields';
                        this.logger.log(`Seeding Module / Model / Fields`);
                        const moduleModelFieldCounts = await this.timeOperation('seed-module-model-fields', () => this.seedModuleModelFields(moduleMetadata), { moduleName: moduleMetadata.name, component: 'module-model-fields' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Module/Model/Fields', moduleModelFieldCounts)}`);

                currentStep = 'seedLocales';
                this.logger.log(`Seeding Locales`);
                const localeCounts = await this.seedLocales(overallMetadata);
                console.log(`${this.formatSeedResult(moduleMetadata.name, 'Locales', localeCounts)}`);

                        currentStep = 'seedPermissions';
                        this.logger.log(`Seeding Permissions`);
                        const permissionCounts = await this.timeOperation('seed-permissions', () => this.seedPermissions(overallMetadata), { moduleName: moduleMetadata.name, component: 'permissions' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Permissions', permissionCounts)}`);

                        currentStep = 'seedRoles';
                        this.logger.log(`Seeding Roles`);
                        const roleCounts = await this.timeOperation('seed-roles', () => this.seedRoles(overallMetadata), { moduleName: moduleMetadata.name, component: 'roles' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Roles', roleCounts)}`);

                        currentStep = 'seedUsers';
                        this.logger.log(`Seeding Users`);
                        const userCounts = await this.timeOperation('seed-users', () => this.seedUsers(overallMetadata), { moduleName: moduleMetadata.name, component: 'users' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Users', userCounts)}`);

                        currentStep = 'seedViews';
                        this.logger.log(`Seeding Views`);
                        const viewCounts = await this.timeOperation('seed-views', () => this.seedViews(overallMetadata), { moduleName: moduleMetadata.name, component: 'views' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Views', viewCounts)}`);

                        currentStep = 'seedActions';
                        this.logger.log(`Seeding Actions`);
                        const actionCounts = await this.timeOperation('seed-actions', () => this.seedActions(overallMetadata), { moduleName: moduleMetadata.name, component: 'actions' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Actions', actionCounts)}`);

                        currentStep = 'seedMenus';
                        this.logger.log(`Seeding Menus`);
                        const menuCounts = await this.timeOperation('seed-menus', () => this.seedMenus(overallMetadata), { moduleName: moduleMetadata.name, component: 'menus' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Menus', menuCounts)}`);

                        currentStep = 'seedEmailTemplates';
                        this.logger.log(`Seeding Email Templates`);
                        const emailTemplateCounts = await this.timeOperation('seed-email-templates', () => this.seedEmailTemplates(overallMetadata, moduleMetadata.name), { moduleName: moduleMetadata.name, component: 'email-templates' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Email Templates', emailTemplateCounts)}`);

                        currentStep = 'seedSmsTemplates';
                        this.logger.log(`Seeding Sms Templates`);
                        const smsTemplateCounts = await this.timeOperation('seed-sms-templates', () => this.seedSmsTemplates(overallMetadata, moduleMetadata.name), { moduleName: moduleMetadata.name, component: 'sms-templates' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Sms Templates', smsTemplateCounts)}`);

                        currentStep = 'seedSecurityRules';
                        this.logger.log(`Seeding Security Rules`);
                        const securityRuleCounts = await this.timeOperation('seed-security-rules', () => this.seedSecurityRules(overallMetadata), { moduleName: moduleMetadata.name, component: 'security-rules' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Security Rules', securityRuleCounts)}`);

                        currentStep = 'seedListOfValues';
                        this.logger.log(`Seeding List Of Values`);
                        const lovCounts = await this.timeOperation('seed-list-of-values', () => this.seedListOfValues(moduleMetadata, overallMetadata), { moduleName: moduleMetadata.name, component: 'list-of-values' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'List Of Values', lovCounts)}`);

                        currentStep = 'seedScheduledJobs';
                        this.logger.log(`Seeding Scheduled Jobs`);
                        const scheduledJobCounts = await this.timeOperation('seed-scheduled-jobs', () => this.seedScheduledJobs(moduleMetadata, overallMetadata), { moduleName: moduleMetadata.name, component: 'scheduled-jobs' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Scheduled Jobs', scheduledJobCounts)}`);

                        currentStep = 'seedSavedFilters';
                        this.logger.log(`Seeding Saved Filters`);
                        const savedFilterCounts = await this.timeOperation('seed-saved-filters', () => this.seedSavedFilters(moduleMetadata, overallMetadata), { moduleName: moduleMetadata.name, component: 'saved-filters' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Saved Filters', savedFilterCounts)}`);

                        currentStep = 'seedModelSequences';
                        this.logger.log(`Seeding Model Sequences`);
                        const modelSequenceCounts = await this.timeOperation('seed-model-sequences', () => this.seedModelSequences(overallMetadata), { moduleName: moduleMetadata.name, component: 'model-sequences' });
                        console.log(`${this.formatSeedResult(moduleMetadata.name, 'Model Sequences', modelSequenceCounts)}`);
                    }, { moduleName: moduleMetadata.name, component: 'module-seed' });
                }

                currentModule = 'global';
                currentStep = 'setupDefaultRolesWithPermissions';
                await this.timeOperation('setup-default-roles-with-permissions', () => this.setupDefaultRolesWithPermissions(), { moduleName: 'global', component: 'default-roles' });
            }, { moduleName: 'global', component: 'seed-run' });

            // Add a console log indicating seeding is finished. This needs to be console.log so that it looks proper when this code is run via CLI.
            console.log(`✔ Seeding completed.`);
            //this.logger.log(`All Seeders finished`);

            //FIXME: Handle displaying the created users credentials in a better way.
            // this.logger.log(`Newly created username is: ${usersDetail?.length > 0 ? usersDetail[0]?.username : ''} and password is ${usersDetail?.length > 0 ? usersDetail[0]?.password : ''}`);
        } catch (error: any) {
            this.logSeedFailureForCli(error, {
                moduleName: currentModule,
                step: currentStep,
                pruneEnabled: this.enablePruning,
                modulesToSeed,
            });
            throw error;
        }
    }

    private buildTimingPrefix(itemTag: string, options?: { moduleName?: string; component?: string; serviceCall?: string }): string {
        const parts = [`[${this.seedTimingTag}]`, `[ITEM:${itemTag}]`];
        if (options?.moduleName) {
            parts.push(`[MODULE:${options.moduleName}]`);
        }
        if (options?.component) {
            parts.push(`[COMPONENT:${options.component}]`);
        }
        if (options?.serviceCall) {
            parts.push(`[CALL:${options.serviceCall}]`);
        }
        return parts.join(' ');
    }

    private formatDuration(durationMs: number): string {
        return durationMs >= 1000
            ? `${(durationMs / 1000).toFixed(2)} s (${durationMs.toFixed(2)} ms)`
            : `${durationMs.toFixed(2)} ms`;
    }

    private resetLookupCaches(): void {
        this.moduleLookupCache.clear();
        this.modelLookupCache.clear();
        this.viewLookupCache.clear();
        this.mediaStorageProviderLookupCache.clear();
    }

    // These cache-backed helpers now log only cache misses. Earlier versions also logged cache hits and operation
    // starts, but that produced too much verbose noise relative to the debugging value.
    private async getModuleByUserKeyCached(
        moduleUserKey: string,
        options?: { moduleName?: string; component?: string; details?: string },
    ): Promise<ModuleMetadata | null> {
        if (!moduleUserKey) {
            return null;
        }
        if (this.moduleLookupCache.has(moduleUserKey)) {
            return this.moduleLookupCache.get(moduleUserKey) ?? null;
        }

        const module = await this.timeOperation('module-find-by-user-key-cache-miss', () => this.moduleMetadataService.findOneByUserKey(moduleUserKey), {
            moduleName: options?.moduleName ?? moduleUserKey,
            component: options?.component,
            serviceCall: 'moduleMetadataService.findOneByUserKey',
            details: options?.details ?? `module=${moduleUserKey}`,
        });
        this.moduleLookupCache.set(moduleUserKey, module ?? null);
        return module ?? null;
    }

    private async getModelByUserKeyCached(
        modelUserKey: string,
        options?: { moduleName?: string; component?: string; details?: string },
    ): Promise<ModelMetadata | null> {
        if (!modelUserKey) {
            return null;
        }
        if (this.modelLookupCache.has(modelUserKey)) {
            return this.modelLookupCache.get(modelUserKey) ?? null;
        }

        const model = await this.timeOperation('model-find-by-user-key-cache-miss', () => this.modelMetadataService.findOneByUserKey(modelUserKey), {
            moduleName: options?.moduleName,
            component: options?.component,
            serviceCall: 'modelMetadataService.findOneByUserKey',
            details: options?.details ?? `model=${modelUserKey}`,
        });
        this.modelLookupCache.set(modelUserKey, model ?? null);
        return model ?? null;
    }

    private async getViewByUserKeyCached(
        viewUserKey: string,
        options?: { moduleName?: string; component?: string; details?: string },
    ): Promise<ViewMetadata | null> {
        if (!viewUserKey) {
            return null;
        }
        if (this.viewLookupCache.has(viewUserKey)) {
            return this.viewLookupCache.get(viewUserKey) ?? null;
        }

        const view = await this.timeOperation('view-find-by-user-key-cache-miss', () => this.solidViewService.findOneByUserKey(viewUserKey), {
            moduleName: options?.moduleName,
            component: options?.component,
            serviceCall: 'solidViewService.findOneByUserKey',
            details: options?.details ?? `view=${viewUserKey}`,
        });
        this.viewLookupCache.set(viewUserKey, view ?? null);
        return view ?? null;
    }

    private async getMediaStorageProviderByUserKeyCached(
        mediaStorageProviderUserKey: string,
        options?: { moduleName?: string; component?: string; details?: string },
    ): Promise<any | null> {
        if (!mediaStorageProviderUserKey) {
            return null;
        }
        if (this.mediaStorageProviderLookupCache.has(mediaStorageProviderUserKey)) {
            return this.mediaStorageProviderLookupCache.get(mediaStorageProviderUserKey) ?? null;
        }

        const mediaStorageProvider = await this.timeOperation('media-storage-provider-find-by-user-key-cache-miss', () => this.mediaStorageProviderMetadataService.findOneByUserKey(mediaStorageProviderUserKey), {
            moduleName: options?.moduleName,
            component: options?.component,
            serviceCall: 'mediaStorageProviderMetadataService.findOneByUserKey',
            details: options?.details ?? `provider=${mediaStorageProviderUserKey}`,
        });
        this.mediaStorageProviderLookupCache.set(mediaStorageProviderUserKey, mediaStorageProvider ?? null);
        return mediaStorageProvider ?? null;
    }

    private async timeOperation<T>(
        itemTag: string,
        operation: () => Promise<T>,
        options?: { moduleName?: string; component?: string; serviceCall?: string; details?: string },
    ): Promise<T> {
        const prefix = this.buildTimingPrefix(itemTag, options);
        const detailSuffix = options?.details ? ` ${options.details}` : '';
        const start = process.hrtime.bigint();

        try {
            const result = await operation();
            const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
            this.logger.debug(`${prefix} done in ${this.formatDuration(durationMs)}${detailSuffix}`);
            return result;
        } catch (error) {
            const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
            this.logger.debug(`${prefix} failed after ${this.formatDuration(durationMs)}${detailSuffix}`);
            throw error;
        }
    }

    private async seedScheduledJobs(moduleMetadata: CreateModuleMetadataDto, overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        const scheduledJobs = this.getSeedArray<CreateScheduledJobDto>(overallMetadata?.scheduledJobs);
        const pruned = this.enablePruning ? await this.timeOperation('prune-scheduled-jobs', () => this.pruneScheduledJobs(scheduledJobs, moduleMetadata.name), {
            moduleName: moduleMetadata.name,
            component: 'scheduled-jobs',
            serviceCall: 'pruneScheduledJobs',
        }) : 0;
        if (scheduledJobs.length > 0) {
            await this.timeOperation('handle-scheduled-jobs', () => this.handleSeedScheduledJobs(scheduledJobs), {
                moduleName: moduleMetadata.name,
                component: 'scheduled-jobs',
                serviceCall: 'handleSeedScheduledJobs',
            });
        }
        return { pruned, upserted: scheduledJobs.length };
    }

    private async seedSavedFilters(moduleMetadata: CreateModuleMetadataDto, overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        const savedFilters = this.getSeedArray<CreateSavedFiltersDto>(overallMetadata?.savedFilters);
        const pruned = this.enablePruning ? await this.timeOperation('prune-saved-filters', () => this.pruneSavedFilters(savedFilters, moduleMetadata.name), {
            moduleName: moduleMetadata.name,
            component: 'saved-filters',
            serviceCall: 'pruneSavedFilters',
        }) : 0;
        if (savedFilters.length > 0) {
            await this.timeOperation('handle-saved-filters', () => this.handleSeedSavedFilters(savedFilters), {
                moduleName: moduleMetadata.name,
                component: 'saved-filters',
                serviceCall: 'handleSeedSavedFilters',
            });
        }
        return { pruned, upserted: savedFilters.length };
    }

    private async seedListOfValues(moduleMetadata: CreateModuleMetadataDto, overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        const listOfValues = this.getSeedArray<CreateListOfValuesDto>(overallMetadata?.listOfValues);
        const pruned = this.enablePruning ? await this.timeOperation('prune-list-of-values', () => this.pruneListOfValues(listOfValues, moduleMetadata.name), {
            moduleName: moduleMetadata.name,
            component: 'list-of-values',
            serviceCall: 'pruneListOfValues',
        }) : 0;
        await this.timeOperation('handle-list-of-values', () => this.handleSeedListOfValues(listOfValues), {
            moduleName: moduleMetadata.name,
            component: 'list-of-values',
            serviceCall: 'handleSeedListOfValues',
        });
        return { pruned, upserted: listOfValues.length };
    }

    private async seedLocales(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        this.logger.debug(`[Start] Processing locales`);
        const locales = this.getSeedArray<CreateLocaleDto>(overallMetadata?.locales);
        const existingLocales = await this.localeRepo.find();

        if (existingLocales.length > 0) {
            this.solidRegistry.registerlocales(existingLocales);
            this.logger.debug(`[End] Skipping locale seed because locales already exist`);
            return { pruned: 0, upserted: 0 };
        }

        await this.handleSeedLocales(locales);
        this.logger.debug(`[End] Processing locales`);
        return { pruned: 0, upserted: locales.length };
    }

    private async setupDefaultRolesWithPermissions() {
        this.logger.debug(`About to add all permissions to the Admin role`);
        await this.timeOperation('role-add-all-permissions', () => this.roleService.addAllPermissionsToRole(ADMIN_ROLE_NAME), {
            moduleName: 'global',
            component: 'default-roles',
            serviceCall: 'roleService.addAllPermissionsToRole',
            details: `role=${ADMIN_ROLE_NAME}`,
        });

        // The below code is commented out for now as we are including permissions for these roles from the seeder json for the Internal and Public role. 
        // 2. Give  permissions to the Internal / Public role.
        // this.logger.debug(`About to add all permissions to the Internal role`);
        // await this.roleService.addPermissionToRole(INTERNAL_ROLE_NAME, INTERNAL_ROLE_PERMISSIONS);

        // this.logger.debug(`About to add all permissions to the Public role`);
        // await this.roleService.addPermissionToRole(PUBLIC_ROLE_NAME, ['SettingController.wrapSettings', 'AuthenticationController.logout']);
    }

    private async seedSecurityRules(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        const securityRules = this.getSeedArray<CreateSecurityRuleDto>(overallMetadata?.securityRules);
        const pruned = this.enablePruning ? await this.timeOperation('prune-security-rules', () => this.pruneSecurityRules(securityRules, overallMetadata?.moduleMetadata?.name), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'security-rules',
            serviceCall: 'pruneSecurityRules',
        }) : 0;
        await this.timeOperation('handle-security-rules', () => this.handleSeedSecurityRules(securityRules), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'security-rules',
            serviceCall: 'handleSeedSecurityRules',
        });
        return { pruned, upserted: securityRules.length };
    }

    // Ok
    private async seedDefaultSettings() {
        await this.timeOperation('seed-default-settings-call', () => this.settingService.seedSystemAdminEditableAndAboveSettings(), {
            moduleName: 'global',
            component: 'settings',
            serviceCall: 'settingService.seedSystemAdminEditableAndAboveSettings',
        });
    }

    private async seedSmsTemplates(overallMetadata: any, moduleName: string): Promise<{ pruned: number; upserted: number }> {
        const smsTemplates = this.getSeedArray<CreateSmsTemplateDto>(overallMetadata?.smsTemplates);
        await this.timeOperation('handle-sms-templates', () => this.handleSeedSmsTemplates(smsTemplates, moduleName), {
            moduleName,
            component: 'sms-templates',
            serviceCall: 'handleSeedSmsTemplates',
        });
        return { pruned: 0, upserted: smsTemplates.length };
    }

    // OK
    private async seedEmailTemplates(overallMetadata: any, moduleName: string): Promise<{ pruned: number; upserted: number }> {
        const emailTemplates = this.getSeedArray<CreateEmailTemplateDto>(overallMetadata?.emailTemplates);
        await this.timeOperation('handle-email-templates', () => this.handleSeedEmailTemplates(emailTemplates, moduleName), {
            moduleName,
            component: 'email-templates',
            serviceCall: 'handleSeedEmailTemplates',
        });
        return { pruned: 0, upserted: emailTemplates.length };
    }

    // Ok
    private async seedMenus(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        const menus = this.getSeedArray<any>(overallMetadata?.menus);
        const pruned = this.enablePruning ? await this.timeOperation('prune-menus', () => this.pruneMenus(menus, overallMetadata?.moduleMetadata?.name), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'menus',
            serviceCall: 'pruneMenus',
        }) : 0;
        await this.timeOperation('handle-menus', () => this.handleSeedMenus(menus), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'menus',
            serviceCall: 'handleSeedMenus',
        });
        return { pruned, upserted: menus.length };
    }

    // Ok
    private async seedActions(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        const actions = this.getSeedArray<any>(overallMetadata?.actions);
        const pruned = this.enablePruning ? await this.timeOperation('prune-actions', () => this.pruneActions(actions, overallMetadata?.moduleMetadata?.name), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'actions',
            serviceCall: 'pruneActions',
        }) : 0;
        await this.timeOperation('handle-actions', () => this.handleSeedActions(actions), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'actions',
            serviceCall: 'handleSeedActions',
        });
        return { pruned, upserted: actions.length };
    }

    // Ok
    private async seedViews(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        const views = this.getSeedArray<any>(overallMetadata?.views);
        const pruned = this.enablePruning ? await this.timeOperation('prune-views', () => this.pruneViews(views, overallMetadata?.moduleMetadata?.name), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'views',
            serviceCall: 'pruneViews',
        }) : 0;
        await this.timeOperation('handle-views', () => this.handleSeedViews(views), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'views',
            serviceCall: 'handleSeedViews',
        });
        return { pruned, upserted: views.length };
    }

    // Ok
    private async seedUsers(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        const users = this.getSeedArray<SignUpDto>(overallMetadata?.users);
        // usersDetail = users;
        await this.timeOperation('handle-users', () => this.handleSeedUsers(users), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'users',
            serviceCall: 'handleSeedUsers',
        });
        return { pruned: 0, upserted: users.length };
    }

    // OK
    private async seedRoles(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        const roles = this.getSeedArray<CreateRoleMetadataDto>(overallMetadata?.roles);
        // Preserve module linkage metadata so RoleMetadata.module is populated from the defining module.
        await this.timeOperation('roles-create-if-not-exists', () => this.roleService.createRolesIfNotExists(
            roles
                .filter((role) => role?.name)
                .map((role) => ({
                    name: role.name,
                    moduleId: role.moduleId,
                    moduleUserKey: role.moduleUserKey ?? overallMetadata?.moduleMetadata?.name,
                } as CreateRoleMetadataDto)),
        ), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'roles',
            serviceCall: 'roleService.createRolesIfNotExists',
            details: `roleCount=${roles.length}`,
        });
        // After roles are created, we iterate over all roles and attach permissions (if specified in the seeder json) to the respective role.
        // Every role configuration in the seeder json can optionally have a permissions attribute. 
        for (const role of roles) {
            if (role.permissions) {
                await this.timeOperation('role-add-permissions', () => this.roleService.addPermissionsToRole(
                    role.name,
                    role.permissions
                        .map((permission: any) => typeof permission === 'string' ? permission : permission?.name)
                        .filter(Boolean),
                ), {
                    moduleName: overallMetadata?.moduleMetadata?.name,
                    component: 'roles',
                    serviceCall: 'roleService.addPermissionsToRole',
                    details: `role=${role.name} permissionCount=${role.permissions.length}`,
                });
            }
        }
        return { pruned: 0, upserted: roles.length };
    }

    private async seedPermissions(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        const permissions = overallMetadata.permissions ?? [];
        await this.timeOperation('handle-permissions', () => this.handleSeedPermissions(permissions), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'permissions',
            serviceCall: 'handleSeedPermissions',
        });
        return { pruned: 0, upserted: permissions?.length ?? 0 };
    }

    // OK
    private get seedDataFiles(): any[] {
        const typedSolidCoreMetadata = structuredClone(solidCoreMetadata);
        const seedDataFiles = [typedSolidCoreMetadata];
        // const enabledModules = getDynamicModuleNames();
        const enabledModules = getDynamicModuleNamesBasedOnMetadata();
        for (const enabledModule of enabledModules) {
            const enabledModuleSeedFile = `src/${enabledModule}/metadata/${enabledModule}-metadata.json`;
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
        await this.timeOperation('seed-controller-permissions', () => this.seedControllerPermissions(), {
            moduleName: 'global',
            component: 'controller-permissions',
        });

        // this.logger.log(`Seeding Default Media Storage Providers`);
        // await this.seedDefaultMediaStorageProviders();

        this.logger.log(`Seeding System Fields Metadata`);
        await this.timeOperation('seed-default-system-fields', () => this.seedDefaultSystemFields(), {
            moduleName: 'global',
            component: 'system-fields',
        });

        // Settings
        this.logger.log(`Seeding Default Settings`);
        await this.timeOperation('seed-default-settings', () => this.seedDefaultSettings(), {
            moduleName: 'global',
            component: 'settings',
        });


        this.logger.debug(`Global metadata seeding completed`);
    }

    private async seedDefaultSystemFields() {
        await this.timeOperation('system-fields-seed', () => this.systemFieldsSeederService.seed(), {
            moduleName: 'global',
            component: 'system-fields',
            serviceCall: 'systemFieldsSeederService.seed',
        });
    }

    // OK
    private async seedControllerPermissions() {

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
                }

            } catch (error: any) {
                this.logger.error(error);
            }
        }

        await this.timeOperation('seed-controller-permissions-bulk', () => this.seedPermissionsInBatches(permissionNames, {
            moduleName: 'global',
            component: 'controller-permissions',
        }), {
            moduleName: 'global',
            component: 'controller-permissions',
            serviceCall: 'seedPermissionsInBatches',
            details: `permissionCount=${permissionNames.length} batchSize=${this.permissionSeedBatchSize}`,
        });

        if (this.enablePruning) {
            await this.timeOperation('prune-controller-permissions', () => this.prunePermissions(permissionNames), {
                moduleName: 'global',
                component: 'controller-permissions',
                serviceCall: 'prunePermissions',
            });
        }
    }

    private async handleSeedPermissions(permissions: any[]): Promise<void> {
        const permissionNames = permissions
            .map((permission) => typeof permission === 'string' ? permission : permission?.name)
            .filter(Boolean);

        // This path replaced the old "check one permission at a time" approach that was responsible for one of the
        // biggest seed-time regressions. We now normalize upfront and let the batch helper do set-based existence work.
        await this.seedPermissionsInBatches(permissionNames, {
            component: 'permissions',
        });
    }

    private async seedPermissionsInBatches(
        permissionNames: string[],
        options?: { moduleName?: string; component?: string },
    ): Promise<void> {
        const uniquePermissionNames = this.getUniquePermissionNames(permissionNames);
        if (uniquePermissionNames.length === 0) {
            return;
        }

        // We intentionally process in bounded chunks so we get the performance benefit of set-based reads/writes
        // without loading an unbounded permission list into a single query or save payload.
        for (let index = 0; index < uniquePermissionNames.length; index += this.permissionSeedBatchSize) {
            const batch = uniquePermissionNames.slice(index, index + this.permissionSeedBatchSize);
            const batchNumber = Math.floor(index / this.permissionSeedBatchSize) + 1;

            const existingPermissions = await this.timeOperation('permission-batch-find', () => this.permissionRepo.find({
                where: {
                    name: In(batch),
                }
            }), {
                moduleName: options?.moduleName,
                component: options?.component ?? 'permissions',
                serviceCall: 'permissionRepo.find',
                details: `batch=${batchNumber} batchSize=${batch.length}`,
            });

            const existingPermissionNames = new Set(
                existingPermissions.map((permission) => this.normalizePermissionName(permission.name)),
            );
            const missingPermissionNames = batch.filter(
                (name) => !existingPermissionNames.has(this.normalizePermissionName(name)),
            );

            if (missingPermissionNames.length === 0) {
                continue;
            }

            this.logger.log(`Creating ${missingPermissionNames.length} missing permissions in batch ${batchNumber}.`);
            await this.timeOperation('permission-batch-save', () => this.permissionRepo.save(
                missingPermissionNames.map((name) => this.permissionRepo.create({ name })),
            ), {
                moduleName: options?.moduleName,
                component: options?.component ?? 'permissions',
                serviceCall: 'permissionRepo.save',
                details: `batch=${batchNumber} createCount=${missingPermissionNames.length}`,
            });
        }
    }

    private getUniquePermissionNames(permissionNames: string[]): string[] {
        const normalizedPermissionNames = new Set<string>();
        const uniquePermissionNames: string[] = [];

        for (const permissionName of permissionNames) {
            if (!permissionName) {
                continue;
            }

            // Deduping is intentionally case-insensitive because MSSQL commonly compares these names using a
            // case-insensitive collation. Without that, a batch can think `Foo.Bar` is missing even when
            // `foo.bar` already exists in the database.
            const normalizedPermissionName = this.normalizePermissionName(permissionName);
            if (normalizedPermissionNames.has(normalizedPermissionName)) {
                continue;
            }

            normalizedPermissionNames.add(normalizedPermissionName);
            uniquePermissionNames.push(permissionName.trim());
        }

        return uniquePermissionNames;
    }

    private normalizePermissionName(permissionName: string): string {
        return permissionName.trim().toLowerCase();
    }

    // OK
    // private async seedDefaultMediaStorageProviders() {
    //     await this.mediaStorageProviderSeederService.seed();
    // }

    // OK
    private async seedMediaStorageProviders(mediaStorageProviders: any[]): Promise<{ pruned: number; upserted: number }> {
        const providers = this.getSeedArray<any>(mediaStorageProviders);

        for (let i = 0; i < providers.length; i++) {
            const mediaStorageProvider = providers[i];
            await this.timeOperation('media-storage-provider-upsert', () => this.mediaStorageProviderMetadataService.upsert(mediaStorageProvider), {
                component: 'media-storage-providers',
                serviceCall: 'mediaStorageProviderMetadataService.upsert',
                details: `provider=${mediaStorageProvider?.name ?? mediaStorageProvider?.userKey ?? i}`,
            });
        }
        return { pruned: 0, upserted: providers.length };
    }

    private async seedModelSequences(overallMetadata: any): Promise<{ pruned: number; upserted: number }> {
        const modelSequences = this.getSeedArray<CreateModelSequenceDto>(overallMetadata?.modelSequences);
        const pruned = this.enablePruning ? await this.timeOperation('prune-model-sequences', () => this.pruneModelSequences(modelSequences, overallMetadata?.moduleMetadata?.name), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'model-sequences',
            serviceCall: 'pruneModelSequences',
        }) : 0;
        await this.timeOperation('handle-model-sequences', () => this.handleSeedModelSequences(modelSequences), {
            moduleName: overallMetadata?.moduleMetadata?.name,
            component: 'model-sequences',
            serviceCall: 'handleSeedModelSequences',
        });
        return { pruned, upserted: modelSequences.length };
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
                        require.resolve('@solidxai/core/package.json'),
                    );
                } catch (err: any) {
                    this.logger.debug(
                        'Could not resolve @solidxai/core from node_modules, assuming local execution',
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
                const emailTemplateHandlebar = `src/${moduleName}/metadata/email-templates/${emailTemplate.body}`
                const fullPath = path.join(process.cwd(), emailTemplateHandlebar);
                // this.logger.log(`Seeding custom email template from consuming model at path: ${fullPath}`);
                if (fs.existsSync(fullPath)) {
                    emailTemplate.body = fs.readFileSync(fullPath, 'utf-8').toString();
                }
            }

            // Save to DB.
            await this.timeOperation('email-template-remove', () => this.emailTemplateService.removeByName(emailTemplate.name), {
                moduleName,
                component: 'email-templates',
                serviceCall: 'emailTemplateService.removeByName',
                details: `template=${emailTemplate.name}`,
            });
            await this.timeOperation('email-template-create', () => this.emailTemplateService.create(emailTemplate), {
                moduleName,
                component: 'email-templates',
                serviceCall: 'emailTemplateService.create',
                details: `template=${emailTemplate.name}`,
            });
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
                        require.resolve('@solidxai/core/package.json'),
                    );
                } catch (err: any) {
                    this.logger.debug(
                        'Could not resolve @solidxai/core from node_modules, assuming local execution',
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
                const emailTemplateHandlebar = `src/${moduleName}/metadata/sms-templates/${smsTemplate.body}`
                const fullPath = path.join(process.cwd(), emailTemplateHandlebar);
                // this.logger.log(`Seeding custom sms template from consuming model at path: ${fullPath}`);
                if (fs.existsSync(fullPath)) {
                    smsTemplate.body = fs.readFileSync(fullPath, 'utf-8').toString();
                }
            }


            // Save to DB.
            await this.timeOperation('sms-template-remove', () => this.smsTemplateService.removeByName(smsTemplate.name), {
                moduleName,
                component: 'sms-templates',
                serviceCall: 'smsTemplateService.removeByName',
                details: `template=${smsTemplate.name}`,
            });
            await this.timeOperation('sms-template-create', () => this.smsTemplateService.create(smsTemplate), {
                moduleName,
                component: 'sms-templates',
                serviceCall: 'smsTemplateService.create',
                details: `template=${smsTemplate.name}`,
            });
        }
    }

    // Ok
    private async handleSeedMenus(menus: any) {
        if (!menus) {
            return;
        }

        // Menu writes are now no-op aware, but this block still performs several serial relation lookups per menu.
        // That tradeoff is acceptable for now because the highest-value wins were elsewhere, but if menu seeding
        // becomes the next hotspot the natural next step is bulk-preloading actions/modules/existing menus here too.
        await this.timeOperation('menus-transaction', () => this.dataSource.transaction(async (trx) => {
            const menuRepo = trx.getRepository(MenuItemMetadata);
            const roleRepo = trx.getRepository(RoleMetadata);
            const actionRepo = trx.getRepository(ActionMetadata);
            const moduleRepo = trx.getRepository(ModuleMetadata);

            // 1) Upsert menus WITHOUT roles (manual upsert)
            for (const m of menus) {
                const action = m.actionUserKey
                    ? await this.timeOperation('menu-action-find-one', () => actionRepo.findOne({ where: { name: m.actionUserKey }, select: ["id"] }), {
                        component: 'menus',
                        serviceCall: 'actionRepo.findOne',
                        details: `action=${m.actionUserKey}`,
                    })
                    : null;

                const module = m.moduleUserKey
                    ? await this.timeOperation('menu-module-find-one', () => moduleRepo.findOne({ where: { name: m.moduleUserKey }, select: ["id"] }), {
                        component: 'menus',
                        serviceCall: 'moduleRepo.findOne',
                        details: `module=${m.moduleUserKey}`,
                    })
                    : null;

                const parentMenuItem = m.parentMenuItemUserKey
                    ? await this.timeOperation('menu-parent-find-one', () => menuRepo.findOne({ where: { name: m.parentMenuItemUserKey }, select: ["id"] }), {
                        component: 'menus',
                        serviceCall: 'menuRepo.findOne',
                        details: `parent=${m.parentMenuItemUserKey}`,
                    })
                    : null;

                // Check if a menu with this name already exists
                const existing = await this.timeOperation('menu-existing-find-one', () => menuRepo.findOne({
                    where: { name: m.name },
                    relations: {
                        action: true,
                        module: true,
                        parentMenuItem: true,
                    },
                }), {
                    component: 'menus',
                    serviceCall: 'menuRepo.findOne',
                    details: `menu=${m.name}`,
                });

                // Build the entity data (without id)
                const base = {
                    name: m.name,
                    displayName: m.displayName,
                    action,
                    module,
                    parentMenuItem,
                    sequenceNumber: m.sequenceNumber,
                    iconName: m.iconName,
                };

                const hasChanges = existing
                    ? existing.displayName !== base.displayName
                    || existing.sequenceNumber !== base.sequenceNumber
                    || existing.iconName !== base.iconName
                    || existing.action?.id !== base.action?.id
                    || existing.module?.id !== base.module?.id
                    || existing.parentMenuItem?.id !== base.parentMenuItem?.id
                    : true;

                if (existing && !hasChanges) {
                    this.logger.debug(`Skipping menu upsert for ${m.name}; no changes detected.`);
                    continue;
                }

                // If existing, set its id so save() will perform an update, otherwise insert
                const entity = menuRepo.create(
                    existing ? { id: existing.id, ...base } : base,
                );

                await this.timeOperation('menu-save', () => menuRepo.save(entity), {
                    component: 'menus',
                    serviceCall: 'menuRepo.save',
                    details: `menu=${m.name}`,
                });
            }

            // 2) Fetch ids for batching
            const seeded = await this.timeOperation('menu-seeded-find', () => menuRepo.find({
                where: { name: In(menus.map((m: any) => m.name)) },
                select: ["id", "name"],
            }), {
                component: 'menus',
                serviceCall: 'menuRepo.find',
                details: `count=${menus.length}`,
            });
            const idByName = new Map(seeded.map(s => [s.name, s.id]));

            // 3) Build desired join rows once
            const admin = await this.timeOperation('menu-admin-role-find-one', () => roleRepo.findOne({ where: { name: ADMIN_ROLE_NAME }, select: ["id", "name"] }), {
                component: 'menus',
                serviceCall: 'roleRepo.findOne',
                details: `role=${ADMIN_ROLE_NAME}`,
            });
            const allRoleNames = new Set<string>();
            for (const m of menus) (m.roles ?? []).forEach((r: string) => allRoleNames.add(r));
            if (admin) allRoleNames.add(admin.name);

            const roles = await this.timeOperation('menu-roles-find', () => roleRepo.find({
                where: { name: In([...allRoleNames]) },
                select: ["id", "name"],
            }), {
                component: 'menus',
                serviceCall: 'roleRepo.find',
                details: `roleCount=${allRoleNames.size}`,
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
                await this.timeOperation('menu-role-joins-delete', () => trx
                    .createQueryBuilder()
                    .delete()
                    .from(MENU_ROLE_JOIN_TABLE_NAME) // string table name is fine
                    .where(`${MENU_ROLE_JOIN_TABLE_NAME_MENU_COL} IN (:...ids)`, { ids: menuIds })
                    .execute(), {
                    component: 'menus',
                    serviceCall: 'trx.delete.menuRoleJoins',
                    details: `menuCount=${menuIds.length}`,
                });
            }

            // 4b) bulk insert all pairs
            if (joinRows.length) {
                const values = joinRows.map(r => ({
                    [MENU_ROLE_JOIN_TABLE_NAME_MENU_COL]: r.menuId,
                    [MENU_ROLE_JOIN_TABLE_NAME_ROLE_COL]: r.roleId,
                }));

                await this.timeOperation('menu-role-joins-insert', () => trx
                    .createQueryBuilder()
                    .insert()
                    .into(MENU_ROLE_JOIN_TABLE_NAME)
                    .values(values)
                    // .orIgnore()  // ❌ remove this – it triggers unsupported onUpdate path
                    .execute(), {
                    component: 'menus',
                    serviceCall: 'trx.insert.menuRoleJoins',
                    details: `rowCount=${values.length}`,
                });
            }
        }), { component: 'menus', serviceCall: 'dataSource.transaction' });
    }

    // Ok
    private async handleSeedActions(actions: any) {
        if (!actions) {
            return;
        }

        const actionRepo = this.dataSource.getRepository(ActionMetadata);
        // Prime related-entity caches once before iterating so we do not pay repeated user-key lookups per row.
        await this.timeOperation('action-prime-module-cache', () => this.primeModuleLookupCache(
            actions.map((action: any) => action?.moduleUserKey),
        ), {
            component: 'actions',
            serviceCall: 'primeModuleLookupCache',
            details: `count=${actions.length}`,
        });
        await this.timeOperation('action-prime-model-cache', () => this.primeModelLookupCache(
            actions.map((action: any) => action?.modelUserKey),
        ), {
            component: 'actions',
            serviceCall: 'primeModelLookupCache',
            details: `count=${actions.length}`,
        });
        await this.timeOperation('action-prime-view-cache', () => this.primeViewLookupCache(
            actions.map((action: any) => action?.viewUserKey),
        ), {
            component: 'actions',
            serviceCall: 'primeViewLookupCache',
            details: `count=${actions.length}`,
        });
        const existingActionsByName = await this.timeOperation('action-preload-existing', () => this.loadExistingActionsByName(
            actionRepo,
            actions.map((action: any) => action?.name).filter(Boolean),
        ), {
            component: 'actions',
            serviceCall: 'loadExistingActionsByName',
            details: `count=${actions.length}`,
        });
        // Keep the verbose output summarized rather than emitting forty separate "skip" lines.
        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (let j = 0; j < actions.length; j++) {
            const actionData = actions[j];
            actionData['module'] = await this.getModuleByUserKeyCached(actionData.moduleUserKey, {
                moduleName: actionData.moduleUserKey,
                component: 'actions',
                details: `module=${actionData.moduleUserKey}`,
            });
            if (actionData.type === 'solid') {
                actionData['model'] = await this.getModelByUserKeyCached(actionData.modelUserKey, {
                    moduleName: actionData.moduleUserKey,
                    component: 'actions',
                    details: `model=${actionData.modelUserKey}`,
                });
                actionData['view'] = await this.getViewByUserKeyCached(actionData.viewUserKey, {
                    moduleName: actionData.moduleUserKey,
                    component: 'actions',
                    details: `view=${actionData.viewUserKey}`,
                });
            }
            else {
                if (actionData.modelUserKey) {
                    actionData['model'] = await this.getModelByUserKeyCached(actionData.modelUserKey, {
                        moduleName: actionData.moduleUserKey,
                        component: 'actions',
                        details: `model=${actionData.modelUserKey}`,
                    });
                }
            }
            const result = await this.upsertActionMetadataWithPreloadedExisting(actionRepo, existingActionsByName, actionData);
            if (result.outcome === 'created') {
                created += 1;
            } else if (result.outcome === 'updated') {
                updated += 1;
            } else {
                skipped += 1;
            }
        }

        this.logger.debug(`Action seed summary: created=${created}, updated=${updated}, skipped=${skipped}.`);
    }

    // Ok
    private async handleSeedViews(views: any) {
        if (!views) {
            return;
        }

        const viewRepo = this.dataSource.getRepository(ViewMetadata);
        // Same preload/diff strategy as actions: resolve relation references in bulk, load existing rows once,
        // then do the rest of the work in memory so unchanged views never fall through to save().
        await this.timeOperation('view-prime-module-cache', () => this.primeModuleLookupCache(
            views.map((view: any) => view?.moduleUserKey),
        ), {
            component: 'views',
            serviceCall: 'primeModuleLookupCache',
            details: `count=${views.length}`,
        });
        await this.timeOperation('view-prime-model-cache', () => this.primeModelLookupCache(
            views.map((view: any) => view?.modelUserKey),
        ), {
            component: 'views',
            serviceCall: 'primeModelLookupCache',
            details: `count=${views.length}`,
        });
        const existingViewsByName = await this.timeOperation('view-preload-existing', () => this.loadExistingViewsByName(
            viewRepo,
            views.map((view: any) => view?.name).filter(Boolean),
        ), {
            component: 'views',
            serviceCall: 'loadExistingViewsByName',
            details: `count=${views.length}`,
        });
        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (let j = 0; j < views.length; j++) {
            const viewData = views[j];

            // preety format the layout & context. 
            viewData['layout'] = JSON.stringify(viewData['layout'], null, 2);

            viewData['module'] = await this.getModuleByUserKeyCached(viewData.moduleUserKey, {
                moduleName: viewData.moduleUserKey,
                component: 'views',
                details: `module=${viewData.moduleUserKey}`,
            });
            viewData['model'] = await this.getModelByUserKeyCached(viewData.modelUserKey, {
                moduleName: viewData.moduleUserKey,
                component: 'views',
                details: `model=${viewData.modelUserKey}`,
            });

            const result = await this.upsertViewMetadataWithPreloadedExisting(viewRepo, existingViewsByName, viewData);
            this.viewLookupCache.set(viewData.name, result.entity ?? null);
            if (result.outcome === 'created') {
                created += 1;
            } else if (result.outcome === 'updated') {
                updated += 1;
            } else {
                skipped += 1;
            }
        }

        this.logger.debug(`View seed summary: created=${created}, updated=${updated}, skipped=${skipped}.`);
    }

    // OK
    private async handleSeedUsers(users: SignUpDto[]) {
        if (!users) {
            return;
        }

        for (let l = 0; l < users.length; l++) {
            const user: SignUpDto = users[l];
            let exisitingUser = await this.timeOperation('user-find-by-username', () => this.userService.findOneByUsername(user.username), {
                component: 'users',
                serviceCall: 'userService.findOneByUsername',
                details: `username=${user.username}`,
            });
            if (!exisitingUser) {
                if (user.username === 'sa') {
                    user.password = DEFAULT_SA_PASSWORD;
                }

                exisitingUser = await this.timeOperation('user-sign-up', () => this.authenticationService.signUp(user), {
                    component: 'users',
                    serviceCall: 'authenticationService.signUp',
                    details: `username=${user.username}`,
                });
                this.logger.log(`Newly created user ${user.username}`);
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
        const fieldMetadataRepo = this.dataSource.getRepository(FieldMetadata);

        // First we create the module. 
        const module = await this.timeOperation('module-upsert', () => this.moduleMetadataService.upsert(moduleMetadata), {
            moduleName: moduleMetadata.name,
            component: 'module-model-fields',
            serviceCall: 'moduleMetadataService.upsert',
            details: `module=${moduleMetadata.name}`,
        });
        this.moduleLookupCache.set(moduleMetadata.name, module ?? null);
        let pruned = 0;
        let upserted = 1;

        // Next create all the models. 
        const modelsMetadata = this.getSeedArray<CreateModelMetadataDto>(moduleMetadata?.models);
        upserted += modelsMetadata.length;
        for (let j = 0; j < modelsMetadata.length; j++) {
            const modelMetadata = modelsMetadata[j];

            // Before creating the model, we need to make sure we are linking it to the newly created module.
            modelMetadata['module'] = module;
            const { fields: fieldsMetadata, ...modelMetaDataWithoutFields } = modelMetadata;

            // Load and set the parent model if it exists.
            if (modelMetadata.isChild && modelMetadata.parentModelUserKey) {
                const parentModel = await this.getModelByUserKeyCached(modelMetadata.parentModelUserKey, {
                    moduleName: moduleMetadata.name,
                    component: 'module-model-fields',
                    details: `parentModel=${modelMetadata.parentModelUserKey}`,
                });
                modelMetaDataWithoutFields['parentModel'] = parentModel;
            }

            const upsertedModel = await this.timeOperation('model-upsert', () => this.modelMetadataService.upsert(modelMetaDataWithoutFields), {
                moduleName: moduleMetadata.name,
                component: 'module-model-fields',
                serviceCall: 'modelMetadataService.upsert',
                details: `model=${modelMetadata.singularName}`,
            });
            this.modelLookupCache.set(modelMetadata.singularName, upsertedModel ?? null);
            const model = await this.timeOperation('model-find-by-singular-name', () => this.modelMetadataService.findOneBySingularName(modelMetadata.singularName), {
                moduleName: moduleMetadata.name,
                component: 'module-model-fields',
                serviceCall: 'modelMetadataService.findOneBySingularName',
                details: `model=${modelMetadata.singularName}`,
            });

            // iterate over all fields and upsert. 
            if (this.enablePruning) {
                pruned += await this.timeOperation('prune-fields-for-model', () => this.pruneFieldsForModel(model, fieldsMetadata), {
                    moduleName: moduleMetadata.name,
                    component: 'module-model-fields',
                    serviceCall: 'pruneFieldsForModel',
                    details: `model=${modelMetadata.singularName}`,
                });
            }
            let userKeyField = null;
            const userKeyFieldName = modelMetadata.userKeyFieldUserKey;
            // Preload all existing fields for the model once. This is why field upserts are now effectively cheap:
            // we no longer do row-by-row existence checks for every field in steady-state runs.
            const existingFieldsByName = await this.timeOperation('field-preload-for-model', () => this.loadExistingFieldsByName(fieldMetadataRepo, model.id), {
                moduleName: moduleMetadata.name,
                component: 'module-model-fields',
                serviceCall: 'loadExistingFieldsByName',
                details: `model=${modelMetadata.singularName}`,
            });
            upserted += fieldsMetadata?.length ?? 0;
            for (let k = 0; k < fieldsMetadata.length; k++) {
                const fieldMetadata = fieldsMetadata[k];

                // Link model & mediaStorageProvider. 
                fieldMetadata['model'] = model;
                if (fieldMetadata.mediaStorageProviderUserKey) {
                    fieldMetadata['mediaStorageProvider'] = await this.getMediaStorageProviderByUserKeyCached(fieldMetadata.mediaStorageProviderUserKey, {
                        moduleName: moduleMetadata.name,
                        component: 'module-model-fields',
                        details: `provider=${fieldMetadata.mediaStorageProviderUserKey}`,
                    });
                }
                // console.log(fieldMetadata.displayName);

                const affectedField = await this.timeOperation('field-upsert', () => this.upsertFieldMetadataWithPreloadedExisting(fieldMetadataRepo, existingFieldsByName, fieldMetadata), {
                    moduleName: moduleMetadata.name,
                    component: 'module-model-fields',
                    serviceCall: 'upsertFieldMetadataWithPreloadedExisting',
                    details: `field=${fieldMetadata.name} model=${modelMetadata.singularName}`,
                });
                if (fieldMetadata.name === userKeyFieldName || fieldMetadata.isUserKey) {
                    const { model, ...fieldData } = affectedField;
                    userKeyField = fieldData;
                }
            }

            // Now that we have created fields & model update the model to stamp the userKeyField. 
            if (userKeyField) {
                modelMetaDataWithoutFields['userKeyField'] = userKeyField;
                await this.timeOperation('model-user-key-field-upsert', () => this.modelMetadataService.upsert(modelMetaDataWithoutFields), {
                    moduleName: moduleMetadata.name,
                    component: 'module-model-fields',
                    serviceCall: 'modelMetadataService.upsert',
                    details: `model=${modelMetadata.singularName} userKeyField=${userKeyField?.name ?? 'unknown'}`,
                });
            }
        }
        if (this.enablePruning) {
            pruned += await this.timeOperation('prune-models', () => this.pruneModels(modelsMetadata, moduleMetadata.name), {
                moduleName: moduleMetadata.name,
                component: 'module-model-fields',
                serviceCall: 'pruneModels',
            });
        }
        return { pruned, upserted };
    }

    private getSeedArray<T>(value: T[] | null | undefined): T[] {
        return Array.isArray(value) ? value : [];
    }

    private async loadExistingFieldsByName(fieldMetadataRepo: Repository<FieldMetadata>, modelId: number): Promise<Map<string, FieldMetadata>> {
        const existingFields = await fieldMetadataRepo.find({
            where: {
                model: { id: modelId },
            },
            relations: {
                model: true,
                mediaStorageProvider: true,
            },
        });

        return new Map(existingFields.map((field) => [field.name, field]));
    }

    private async primeModuleLookupCache(moduleUserKeys: Array<string | null | undefined>): Promise<void> {
        const missingModuleUserKeys = [...new Set(moduleUserKeys.filter((moduleUserKey): moduleUserKey is string =>
            Boolean(moduleUserKey) && !this.moduleLookupCache.has(moduleUserKey),
        ))];

        if (missingModuleUserKeys.length === 0) {
            return;
        }

        // Only bulk-load keys that are still missing from the process-local cache.
        const moduleRepo = this.dataSource.getRepository(ModuleMetadata);
        const existingModules = await moduleRepo.find({
            where: {
                name: In(missingModuleUserKeys),
            },
        });

        const moduleByName = new Map(existingModules.map((module) => [module.name, module]));
        for (const moduleUserKey of missingModuleUserKeys) {
            this.moduleLookupCache.set(moduleUserKey, moduleByName.get(moduleUserKey) ?? null);
        }
    }

    private async primeModelLookupCache(modelUserKeys: Array<string | null | undefined>): Promise<void> {
        const missingModelUserKeys = [...new Set(modelUserKeys.filter((modelUserKey): modelUserKey is string =>
            Boolean(modelUserKey) && !this.modelLookupCache.has(modelUserKey),
        ))];

        if (missingModelUserKeys.length === 0) {
            return;
        }

        const modelRepo = this.dataSource.getRepository(ModelMetadata);
        const existingModels = await modelRepo.find({
            where: {
                singularName: In(missingModelUserKeys),
            },
            relations: {
                module: true,
                userKeyField: true,
            },
        });

        const modelBySingularName = new Map(existingModels.map((model) => [model.singularName, model]));
        for (const modelUserKey of missingModelUserKeys) {
            this.modelLookupCache.set(modelUserKey, modelBySingularName.get(modelUserKey) ?? null);
        }
    }

    private async primeViewLookupCache(viewUserKeys: Array<string | null | undefined>): Promise<void> {
        const missingViewUserKeys = [...new Set(viewUserKeys.filter((viewUserKey): viewUserKey is string =>
            Boolean(viewUserKey) && !this.viewLookupCache.has(viewUserKey),
        ))];

        if (missingViewUserKeys.length === 0) {
            return;
        }

        const viewRepo = this.dataSource.getRepository(ViewMetadata);
        const existingViews = await viewRepo.find({
            where: {
                name: In(missingViewUserKeys),
            },
            relations: {
                module: true,
                model: true,
            },
        });

        const viewByName = new Map(existingViews.map((view) => [view.name, view]));
        for (const viewUserKey of missingViewUserKeys) {
            this.viewLookupCache.set(viewUserKey, viewByName.get(viewUserKey) ?? null);
        }
    }

    private async loadExistingViewsByName(viewRepo: Repository<ViewMetadata>, viewNames: string[]): Promise<Map<string, ViewMetadata>> {
        const uniqueViewNames = [...new Set(viewNames.filter(Boolean))];
        if (uniqueViewNames.length === 0) {
            return new Map();
        }

        // Load relation ids needed for no-op detection. If module/model are not present here, unchanged rows look
        // dirty and every view falls through to save().
        const existingViews = await viewRepo.find({
            where: {
                name: In(uniqueViewNames),
            },
            relations: {
                module: true,
                model: true,
            },
        });

        return new Map(existingViews.map((view) => [view.name, view]));
    }

    private async loadExistingActionsByName(actionRepo: Repository<ActionMetadata>, actionNames: string[]): Promise<Map<string, ActionMetadata>> {
        const uniqueActionNames = [...new Set(actionNames.filter(Boolean))];
        if (uniqueActionNames.length === 0) {
            return new Map();
        }

        // Same reason as views: the diff logic compares relation ids, so those relations must be loaded here.
        const existingActions = await actionRepo.find({
            where: {
                name: In(uniqueActionNames),
            },
            relations: {
                module: true,
                model: true,
                view: true,
            },
        });

        return new Map(existingActions.map((action) => [action.name, action]));
    }

    private normalizeJsonFieldValue(value: any): any {
        // Normalize persisted JSON strings and in-memory objects/arrays into the same canonical shape before compare.
        if (typeof value === 'string') {
            const trimmedValue = value.trim();
            if (
                (trimmedValue.startsWith('{') && trimmedValue.endsWith('}'))
                || (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'))
            ) {
                try {
                    return this.normalizeJsonFieldValue(JSON.parse(trimmedValue));
                } catch {
                    return value;
                }
            }

            return value;
        }

        if (Array.isArray(value)) {
            return value.map((item) => this.normalizeJsonFieldValue(item));
        }

        if (value && typeof value === 'object') {
            return Object.keys(value)
                .sort()
                .reduce((result, key) => {
                    result[key] = this.normalizeJsonFieldValue(value[key]);
                    return result;
                }, {} as Record<string, any>);
        }

        return value;
    }

    private getCanonicalJsonFieldString(value: any): string {
        return JSON.stringify(this.normalizeJsonFieldValue(value) ?? null);
    }

    private hasViewMetadataChanges(existingView: ViewMetadata, updateDto: any): boolean {
        const relationFields = new Set(['module', 'model']);
        const jsonFields = new Set(['layout', 'context']);

        // Compare only the persisted fields we explicitly care about. Generic object-wide diffing became fragile once
        // seeding DTOs started carrying transient helper properties that should not trigger writes.
        return this.viewComparableFields.some((key) => {
            const value = updateDto[key];
            if (typeof value === 'undefined') {
                return false;
            }

            if (relationFields.has(key)) {
                const relationValue = value as any;
                return (existingView as any)[key]?.id !== relationValue?.id;
            }

            if (jsonFields.has(key)) {
                return this.getCanonicalJsonFieldString((existingView as any)[key]) !== this.getCanonicalJsonFieldString(value);
            }

            return (existingView as any)[key] !== value;
        });
    }

    private hasActionMetadataChanges(existingAction: ActionMetadata, updateDto: any): boolean {
        const relationFields = new Set(['module', 'model', 'view']);
        const jsonFields = new Set(['domain', 'context']);

        return this.actionComparableFields.some((key) => {
            const value = updateDto[key];
            if (typeof value === 'undefined') {
                return false;
            }

            if (relationFields.has(key)) {
                const relationValue = value as any;
                return (existingAction as any)[key]?.id !== relationValue?.id;
            }

            if (jsonFields.has(key)) {
                return this.getCanonicalJsonFieldString((existingAction as any)[key]) !== this.getCanonicalJsonFieldString(value);
            }

            return (existingAction as any)[key] !== value;
        });
    }

    private async upsertViewMetadataWithPreloadedExisting(
        viewRepo: Repository<ViewMetadata>,
        existingViewsByName: Map<string, ViewMetadata>,
        updateDto: any,
    ): Promise<{ entity: ViewMetadata; outcome: 'created' | 'updated' | 'skipped' }> {
        const existingView = existingViewsByName.get(updateDto.name);

        if (existingView) {
            // In the steady-state case we want to return fast here and avoid save() entirely.
            if (!this.hasViewMetadataChanges(existingView, updateDto)) {
                return { entity: existingView, outcome: 'skipped' };
            }

            const updatedView = { ...existingView, ...updateDto };
            const savedView = await this.timeOperation('view-save', () => viewRepo.save(updatedView as ViewMetadata), {
                component: 'views',
                serviceCall: 'viewRepo.save',
                details: `view=${updateDto.name}`,
            }) as ViewMetadata;
            existingViewsByName.set(updateDto.name, savedView);
            return { entity: savedView, outcome: 'updated' };
        }

        const view = viewRepo.create(updateDto as Partial<ViewMetadata>);
        const savedView = await this.timeOperation('view-save', () => viewRepo.save(view as ViewMetadata), {
            component: 'views',
            serviceCall: 'viewRepo.save',
            details: `view=${updateDto.name}`,
        }) as ViewMetadata;
        existingViewsByName.set(updateDto.name, savedView);
        return { entity: savedView, outcome: 'created' };
    }

    private async upsertActionMetadataWithPreloadedExisting(
        actionRepo: Repository<ActionMetadata>,
        existingActionsByName: Map<string, ActionMetadata>,
        updateDto: any,
    ): Promise<{ entity: ActionMetadata; outcome: 'created' | 'updated' | 'skipped' }> {
        const existingAction = existingActionsByName.get(updateDto.name);

        if (existingAction) {
            if (!this.hasActionMetadataChanges(existingAction, updateDto)) {
                return { entity: existingAction, outcome: 'skipped' };
            }

            const updatedAction = { ...existingAction, ...updateDto };
            const savedAction = await this.timeOperation('action-save', () => actionRepo.save(updatedAction as ActionMetadata), {
                component: 'actions',
                serviceCall: 'actionRepo.save',
                details: `action=${updateDto.name}`,
            }) as ActionMetadata;
            existingActionsByName.set(updateDto.name, savedAction);
            return { entity: savedAction, outcome: 'updated' };
        }

        const action = actionRepo.create(updateDto as Partial<ActionMetadata>);
        const savedAction = await this.timeOperation('action-save', () => actionRepo.save(action as ActionMetadata), {
            component: 'actions',
            serviceCall: 'actionRepo.save',
            details: `action=${updateDto.name}`,
        }) as ActionMetadata;
        existingActionsByName.set(updateDto.name, savedAction);
        return { entity: savedAction, outcome: 'created' };
    }

    private async upsertFieldMetadataWithPreloadedExisting(
        fieldMetadataRepo: Repository<FieldMetadata>,
        existingFieldsByName: Map<string, FieldMetadata>,
        updateDto: any,
    ): Promise<FieldMetadata> {
        const existingFieldMetadata = existingFieldsByName.get(updateDto.name);

        if (existingFieldMetadata) {
            // Field metadata still uses a broad DTO diff because the major performance problem here was query volume,
            // not the in-memory comparison itself.
            const hasChanges = Object.entries(updateDto).some(([key, value]) => {
                const relationValue = value as any;
                if (key === 'model') {
                    return existingFieldMetadata.model?.id !== relationValue?.id;
                }
                if (key === 'mediaStorageProvider') {
                    return existingFieldMetadata.mediaStorageProvider?.id !== relationValue?.id;
                }
                const currentValue = (existingFieldMetadata as any)[key];
                if (Array.isArray(currentValue) || Array.isArray(value)) {
                    return JSON.stringify(currentValue ?? null) !== JSON.stringify(value ?? null);
                }
                if (value && typeof value === 'object') {
                    return JSON.stringify(currentValue ?? null) !== JSON.stringify(value ?? null);
                }
                return currentValue !== value;
            });

            if (!hasChanges) {
                return existingFieldMetadata;
            }

            const updatedFieldMetadata = { ...existingFieldMetadata, ...updateDto };
            const savedFieldMetadata = await fieldMetadataRepo.save(updatedFieldMetadata as FieldMetadata) as FieldMetadata;
            existingFieldsByName.set(updateDto.name, savedFieldMetadata);
            return savedFieldMetadata;
        }

        const fieldMetadata = fieldMetadataRepo.create(updateDto as Partial<FieldMetadata>);
        const savedFieldMetadata = await fieldMetadataRepo.save(fieldMetadata as FieldMetadata) as FieldMetadata;
        existingFieldsByName.set(updateDto.name, savedFieldMetadata);
        return savedFieldMetadata;
    }

    private async handleSeedSecurityRules(rulesDto: CreateSecurityRuleDto[]) {
        if (!rulesDto || rulesDto.length === 0) {
            this.logger.debug(`No security rules found to seed`);
            return;
        }
        for (const dto of rulesDto) {
            await this.timeOperation('security-rule-upsert', () => this.securityRuleRepo.upsertWithDto({ ...dto, securityRuleConfig: JSON.stringify(dto.securityRuleConfig) }), {
                component: 'security-rules',
                serviceCall: 'securityRuleRepo.upsertWithDto',
                details: `rule=${dto.name}`,
            });
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
            listOfValueDto['module'] = await this.getModuleByUserKeyCached(listOfValueDto.moduleUserKey, {
                moduleName: listOfValueDto.moduleUserKey,
                component: 'list-of-values',
                details: `module=${listOfValueDto.moduleUserKey}`,
            });
            await this.timeOperation('lov-upsert', () => this.listOfValuesService.upsert(listOfValuesDto[j]), {
                component: 'list-of-values',
                serviceCall: 'listOfValuesService.upsert',
                details: `type=${listOfValueDto.type} value=${listOfValueDto.value}`,
            });
        }
    }

    private async handleSeedScheduledJobs(createScheduledJobDto: CreateScheduledJobDto[]) {
        if (!createScheduledJobDto || createScheduledJobDto.length === 0) {
            this.logger.debug(`No scheduled jobs found to seed`);
            return;
        }
        for (const dto of createScheduledJobDto) {
            await this.timeOperation('scheduled-job-upsert', () => this.scheduledJobRepository.upsertWithDto(dto), {
                component: 'scheduled-jobs',
                serviceCall: 'scheduledJobRepository.upsertWithDto',
                details: `schedule=${dto.scheduleName}`,
            });
        }
    }

    private async handleSeedSavedFilters(createSavedFilterDto: CreateSavedFiltersDto[]) {
        if (!createSavedFilterDto || createSavedFilterDto.length === 0) {
            this.logger.debug(`No saved filters found to seed`);
            return;
        }
        for (const dto of createSavedFilterDto) {
            this.validateSavedFilterQueryJsonWrapper(dto);
            await this.timeOperation('saved-filter-upsert', () => this.savedFiltersRepo.upsertWithDto({ ...dto, filterQueryJson: JSON.stringify(dto.filterQueryJson), isSeeded: true }), {
                component: 'saved-filters',
                serviceCall: 'savedFiltersRepo.upsertWithDto',
                details: `filter=${dto.name}`,
            });
        }
    }

    private async handleSeedLocales(localesDto: CreateLocaleDto[]) {
        if (!localesDto || localesDto.length === 0) {
            this.logger.debug(`No locales found to seed`);
            return;
        }

        for (const dto of localesDto) {
            if (dto.isDefault) {
                const existingDefaultLocales = await this.localeRepo.find({
                    where: {
                        isDefault: true,
                    } as any,
                });

                for (const locale of existingDefaultLocales) {
                    if (locale.locale !== dto.locale) {
                        await this.localeRepo.save({
                            ...locale,
                            isDefault: false,
                        });
                    }
                }
            }

            const existingLocale = await this.localeRepo.findOne({
                where: {
                    locale: dto.locale,
                } as any,
            });

            await this.localeRepo.save(
                this.localeRepo.create({
                    ...existingLocale,
                    ...dto,
                })
            );
        }

        const locales = await this.localeRepo.find();
        this.solidRegistry.registerlocales(locales);
    }

    private async handleSeedLocales(localesDto: CreateLocaleDto[]) {
        if (!localesDto || localesDto.length === 0) {
            this.logger.debug(`No locales found to seed`);
            return;
        }

        for (const dto of localesDto) {
            if (dto.isDefault) {
                const existingDefaultLocales = await this.localeRepo.find({
                    where: {
                        isDefault: true,
                    } as any,
                });

                for (const locale of existingDefaultLocales) {
                    if (locale.locale !== dto.locale) {
                        await this.localeRepo.save({
                            ...locale,
                            isDefault: false,
                        });
                    }
                }
            }

            const existingLocale = await this.localeRepo.findOne({
                where: {
                    locale: dto.locale,
                } as any,
            });

            await this.localeRepo.save(
                this.localeRepo.create({
                    ...existingLocale,
                    ...dto,
                })
            );
        }

        const locales = await this.localeRepo.find();
        this.solidRegistry.registerlocales(locales);
    }

    private validateSavedFilterQueryJsonWrapper(dto: CreateSavedFiltersDto): void {
        const filterName = dto?.name ?? '<unnamed>';
        const filterQueryJson = dto?.filterQueryJson;
        const baseErrorMessage =
            `Invalid saved filter "${filterName}": filterQueryJson must be wrapped with a top-level "$or" or "$and". ` +
            `Example: {"$or":[{"employeeStatus":{"$eq":"Active"}}]}`;

        if (!filterQueryJson || typeof filterQueryJson !== 'object' || Array.isArray(filterQueryJson)) {
            throw new Error(baseErrorMessage);
        }

        const topLevelKeys = Object.keys(filterQueryJson);
        const hasLogicalWrapper = topLevelKeys.includes('$or') || topLevelKeys.includes('$and');
        if (!hasLogicalWrapper) {
            const receivedKeys = topLevelKeys.length > 0 ? topLevelKeys.join(', ') : '(none)';
            throw new Error(`${baseErrorMessage}. Received top-level keys: ${receivedKeys}`);
        }
    }

    private async handleSeedModelSequences(modelSequencesDto: CreateModelSequenceDto[]) {
        if (!modelSequencesDto || modelSequencesDto.length === 0) {
            this.logger.debug(`No Model Sequences found to seed`);
            return;
        }
        for (const dto of modelSequencesDto) {
            await this.timeOperation('model-sequence-upsert', () => this.modelSequenceRepo.upsertWithDto(dto), {
                component: 'model-sequences',
                serviceCall: 'modelSequenceRepo.upsertWithDto',
                details: `sequence=${dto.sequenceName}`,
            });
        }
    }

    private async pruneModelSequences(modelSequencesDto: CreateModelSequenceDto[] | undefined, moduleName?: string): Promise<number> {
        if (!moduleName) {
            this.logger.warn(`Skipping model sequence prune: missing module name in metadata.`);
            return 0;
        }
        const sequences = modelSequencesDto ?? [];

        const module = await this.getModuleByUserKeyCached(moduleName, {
            moduleName,
            component: 'model-sequences',
            details: `module=${moduleName}`,
        });
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

        const module = await this.getModuleByUserKeyCached(moduleName, {
            moduleName,
            component: 'saved-filters',
            details: `module=${moduleName}`,
        });
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

        const module = await this.getModuleByUserKeyCached(moduleName, {
            moduleName,
            component: 'scheduled-jobs',
            details: `module=${moduleName}`,
        });
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

        const module = await this.getModuleByUserKeyCached(moduleName, {
            moduleName,
            component: 'security-rules',
            details: `module=${moduleName}`,
        });
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

        const module = await this.getModuleByUserKeyCached(moduleName, {
            moduleName,
            component: 'list-of-values',
            details: `module=${moduleName}`,
        });
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

    private async pruneMenus(menusDto: any[] | undefined, moduleName?: string): Promise<number> {
        if (!moduleName) {
            this.logger.warn(`Skipping menus prune: missing module name in metadata.`);
            return 0;
        }
        const menus = menusDto ?? [];

        const module = await this.getModuleByUserKeyCached(moduleName, {
            moduleName,
            component: 'menus',
            details: `module=${moduleName}`,
        });
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

        const module = await this.getModuleByUserKeyCached(moduleName, {
            moduleName,
            component: 'views',
            details: `module=${moduleName}`,
        });
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

        const module = await this.getModuleByUserKeyCached(moduleName, {
            moduleName,
            component: 'actions',
            details: `module=${moduleName}`,
        });
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

        const module = await this.getModuleByUserKeyCached(moduleName, {
            moduleName,
            component: 'module-model-fields',
            details: `module=${moduleName}`,
        });
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

    private logSeedFailureForCli(
        error: unknown,
        context: { moduleName: string; step: string; pruneEnabled: boolean; modulesToSeed: string[] | null }
    ): void {
        const err = error instanceof Error ? error : new Error(String(error));
        const stackLines = (err.stack ?? '')
            .split('\n')
            .slice(0, 8)
            .map((line) => line.trim())
            .filter(Boolean);
        const logPayload = {
            module: context.moduleName,
            step: context.step,
            pruneEnabled: context.pruneEnabled,
            modulesToSeed: context.modulesToSeed?.length ? context.modulesToSeed : 'ALL',
            error: {
                name: err.name,
                message: err.message,
                stackPreview: stackLines.length > 0 ? stackLines : undefined,
            },
        };

        console.log('✖ Seeding failed');
        console.log(JSON.stringify(logPayload, null, 2));
    }

    private formatSeedResult(moduleName: string, label: string, counts: { pruned: number; upserted: number }): string {
        if (this.enablePruning) {
            return `✔ [${moduleName}] ${label} seeded (pruned ${counts.pruned}, upserted ${counts.upserted})`;
        }
        return `✔ [${moduleName}] ${label} seeded (upserted ${counts.upserted})`;
    }

}
