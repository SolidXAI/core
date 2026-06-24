import { Injectable, Logger } from '@nestjs/common';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { IExtensionUserCreationProvider } from 'src/interfaces';
import { User } from 'src/entities/user.entity';
import { ComputedFieldTriggerConfig, ComputedFieldValueType } from 'src/dtos/create-field-metadata.dto';
import { CommonEntity } from 'src/entities/common.entity';
import { Locale } from 'src/entities/locale.entity';
import { SecurityRule } from 'src/entities/security-rule.entity';
import { IScheduledJob } from 'src/services/scheduled-jobs/scheduled-job.interface';
import { IDashboardWidgetDataProvider, IErrorCodeProvider, ISecurityRuleConfigProvider, ISelectionProvider, ISelectionProviderContext, ISolidDatabaseModule } from "../interfaces";
import { EntityManager, ObjectLiteral } from 'typeorm';

type ControllerMetadata = {
  name: string;
  methods: string[];
};

export enum RESERVED_SOLID_KEYWORDS {
  moduleMetadata = "moduleMetadata",
  modelMetadata = "modelMetadata",
  fieldMetadata = "fieldMetadata",
  dataSource = "dataSource",
  repository = "repository",
  entityManager = "entityManager",
  actionMetadata = "actionMetadata",
  emailAttachment = "emailAttachment",
  emailTemplate = "emailTemplate",
  listOfValues = "listOfValues",
  mediaStorageProvider = "mediaStorageProvider",
  media = "media",
  menuItemMetadata = "menuItemMetadata",
  mqMessageQueue = "mqMessageQueue",
  mqMessage = "mqMessage",
  permissionMetadata = "permissionMetadata",
  roleMetadata = "roleMetadata",
  securityRule = "securityRule",
  setting = "setting",
  smsTemplate = "smsTemplate",
  userMetadata = "userMetadata",
  user = "user",
  locale = "locale"
}

export interface TypeOrmEventContext {
  eventType?: string;
  entity?: ObjectLiteral | undefined;
  databaseEntity?: any;
  entityId?: any;
  metadataName?: string;
  updatedColumns?: string[];
  updatedRelations?: string[];
  // Transaction-bound EntityManager from the originating TypeORM event. Providers that
  // need to query the DB during a pre-compute hook must use this (not an injected
  // DataSource/EntityManager) so the query runs on the active transaction's connection.
  // On single-threaded embedded engines (PGlite), a second connection mid-transaction
  // can deadlock.
  manager?: EntityManager;
}

export interface ComputedFieldMetadata<TContext = any> {
  moduleName: string; // Name of the module where the computed field is defined
  modelName: string; // Name of the model where the computed field is defined
  fieldName: string; // Name of the field that is computed
  computedFieldValueType: ComputedFieldValueType; // Type of the computed field value (e.g., string, number, etc.)
  computedFieldTriggerConfig: ComputedFieldTriggerConfig[]; // JSON stringified object containing the trigger configuration
  // Example: '{"models": ["User", "Product"], "operations": ["create", "update"]}'
  computedFieldValueProviderName: string; // Name of the provider that computes the field value
  // Example: '{"contextKey": "contextValue"}'
  computedFieldValueProviderCtxt: TContext; // Context for the computed field value
  eventContext: TypeOrmEventContext;
}

@Injectable()
export class SolidRegistry {
  private readonly logger = new Logger(SolidRegistry.name);
  private extensionUserCreationProvider: InstanceWrapper | null = null;
  private seeders: Set<InstanceWrapper> = new Set();
  private scheduledJobProviders: Set<InstanceWrapper> = new Set();
  private selectionProviders: Set<InstanceWrapper> = new Set();
  private dashboardWidgetDataProviders: Set<InstanceWrapper> = new Set();
  private computedFieldProviders: Set<InstanceWrapper> = new Set();
  private solidDatabaseModules: Set<InstanceWrapper> = new Set();
  private controllers: Set<ControllerMetadata> = new Set();
  private modules: Set<InstanceWrapper> = new Set();
  private securityRules: SecurityRule[] = [];
  private locales: Locale[] = [];
  private computedFieldMetadata: ComputedFieldMetadata[] = [];
  private mailProviders: Set<InstanceWrapper> = new Set();
  private whatsappProviders: Set<InstanceWrapper> = new Set();
  private smsProviders: Set<InstanceWrapper> = new Set();
  private securityRuleConfigProviders: Set<InstanceWrapper> = new Set();
  private errorCodeProviders: Set<InstanceWrapper> = new Set();
  private settingsProviders: Set<InstanceWrapper> = new Set();
  private auditableModels: Set<string> = new Set();

  registerExtensionUserCreationProvider(provider: InstanceWrapper): void {
    if (this.extensionUserCreationProvider) {
      this.logger.warn(
        `ExtensionUserCreationProvider already registered by ${this.extensionUserCreationProvider.name}; ignoring ${provider.name}`,
      );
      return;
    }
    this.extensionUserCreationProvider = provider;
  }

  getExtensionUserCreationProvider<T extends User = User>(): IExtensionUserCreationProvider<T, any> | null {
    return (this.extensionUserCreationProvider?.instance as IExtensionUserCreationProvider<T, any>) ?? null;
  }

  registerErrorCodeProvider(errorCodeProvider: InstanceWrapper): void {
    this.errorCodeProviders.add(errorCodeProvider);
  }

  registerWhatsappProvider(whatsappProvider: InstanceWrapper): void {
    this.whatsappProviders.add(whatsappProvider);
  }

  registerSmsProvider(smsProvider: InstanceWrapper): void {
    this.smsProviders.add(smsProvider);
  }

  registerSecurityRuleConfigProvider(securityRuleConfigProvider: InstanceWrapper): void {
    this.securityRuleConfigProviders.add(securityRuleConfigProvider);
  }

  registerMailProvider(mailProvider: InstanceWrapper): void {
    this.mailProviders.add(mailProvider);
  }

  registerController(name: string, methodNames: string[]): void {
    this.controllers.add({ name: name, methods: methodNames });
  }

  registerControllers(controllers: Set<ControllerMetadata>): void {
    this.controllers = controllers;
  }

  registerSeeder(seeder: InstanceWrapper): void {
    this.seeders.add(seeder);
  }

  registerSelectionProvider(selectionProvider: InstanceWrapper): void {
    this.selectionProviders.add(selectionProvider);
  }

  registerDashboardWidgetDataProvider(provider: InstanceWrapper): void {
    this.dashboardWidgetDataProviders.add(provider);
  }

  registerComputedFieldProvider(computedFieldProvider: InstanceWrapper): void {
    this.computedFieldProviders.add(computedFieldProvider);
  }

  registerScheduledJobProvider(scheduledJobProvider: InstanceWrapper): void {
    this.scheduledJobProviders.add(scheduledJobProvider);
  }

  registerSolidDatabaseModule(solidDatabaseModule: InstanceWrapper): void {
    this.solidDatabaseModules.add(solidDatabaseModule);
  }

  registerModules(modules: InstanceWrapper[]): void {
    this.modules = new Set(modules);
  }

  registerSettingsProvider(provider: InstanceWrapper) {
    this.settingsProviders.add(provider);
  }

  registerSecurityRules(securityRules: SecurityRule[]) {
    this.securityRules = securityRules;
  }

  registerlocales(locales: Locale[]) {
    this.locales = locales;
  }

  registerComputedFieldMetadata(computedFieldMetadata: ComputedFieldMetadata[]) {
    this.computedFieldMetadata = computedFieldMetadata;
  }

  getSettingsProviders(): InstanceWrapper[] {
    return Array.from(this.settingsProviders);
  }

  getSettingsProviderInstance<T extends ISelectionProviderContext>(name: string): ISelectionProvider<T> {
    const settingsProviders = this.getSettingsProviders();

    for (let i = 0; i < settingsProviders.length; i++) {
      const settingsProvider = settingsProviders[i];
      if (settingsProvider.instance.name() === name) {
        return settingsProvider.instance;
      }
    }
  }

  getMailProviders(): Array<InstanceWrapper> {
    return Array.from(this.mailProviders);
  }

  getWhatsappProviders(): Array<InstanceWrapper> {
    return Array.from(this.whatsappProviders);
  }

  getSmsProviders(): Array<InstanceWrapper> {
    return Array.from(this.smsProviders);
  }

  getSecurityRuleConfigProviders(): Array<InstanceWrapper> {
    return Array.from(this.securityRuleConfigProviders);
  }

  getSecurityRuleConfigProviderInstance(name: string): ISecurityRuleConfigProvider {
    const securityRuleConfigProviders = this.getSecurityRuleConfigProviders();

    for (let i = 0; i < securityRuleConfigProviders.length; i++) {
      const securityRuleConfigProvider = securityRuleConfigProviders[i];
      if (securityRuleConfigProvider.name === name) {
        return securityRuleConfigProvider.instance;
      }
    }
  }

  getSeeders(): Array<InstanceWrapper> {
    return Array.from(this.seeders);
  }

  getControllers(): ControllerMetadata[] {
    return Array.from(this.controllers);
  }

  getSelectionProviders(): Array<InstanceWrapper> {
    return Array.from(this.selectionProviders);
  }

  getDashboardWidgetDataProviders(): Array<InstanceWrapper> {
    return Array.from(this.dashboardWidgetDataProviders);
  }

  getSelectionProviderInstance<T extends ISelectionProviderContext>(name: string): ISelectionProvider<T> {
    const selectionProviders = this.getSelectionProviders();

    for (let i = 0; i < selectionProviders.length; i++) {
      const selectionProvider = selectionProviders[i];
      if (selectionProvider.instance.name() === name) {
        return selectionProvider.instance;
      }
    }
  }

  getDashboardWidgetDataProviderInstance(name: string): IDashboardWidgetDataProvider | undefined {
    const providers = this.getDashboardWidgetDataProviders();
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      if (provider?.instance?.name?.() === name || provider?.name === name) {
        return provider.instance as IDashboardWidgetDataProvider;
      }
    }
    return undefined;
  }

  getErrorCodeProviders(): Array<InstanceWrapper> {
    return Array.from(this.errorCodeProviders);
  }

  getErrorCodeProviderInstance(name: string): IErrorCodeProvider | undefined {
    const providers = this.getErrorCodeProviders();
    for (let i = 0; i < providers.length; i++) {
      const p = providers[i];
      if (p.instance?.name?.() === name) return p.instance as IErrorCodeProvider;
    }
    return undefined;
  }

  getComputedFieldProviders(): Array<InstanceWrapper> {
    return Array.from(this.computedFieldProviders);
  }

  getScheduledJobProviders(): Array<InstanceWrapper> {
    return Array.from(this.scheduledJobProviders);
  }

  getScheduledJobProviderInstance(name: string): IScheduledJob {
    const scheduledJobProviders = this.getScheduledJobProviders();

    for (let i = 0; i < scheduledJobProviders.length; i++) {
      const scheduledJobProvider = scheduledJobProviders[i];
      if (scheduledJobProvider.name === name) {
        return scheduledJobProvider.instance;
      }
    }
  }

  getComputedFieldProvider(name: string): InstanceWrapper {
    const provider = this.getComputedFieldProviders().filter((provider) => provider.name === name).pop();
    if (!provider) {
      throw new Error(`Computed Field Provider with name ${name} not found`);
    }
    return provider
  }

  getSolidDatabaseModules(): Array<InstanceWrapper> {
    return Array.from(this.solidDatabaseModules);
  }

  getDefaultSolidDatabaseModule(): ISolidDatabaseModule {
    const solidDatabaseModulesAsArray = Array.from(this.solidDatabaseModules);
    for (let i = 0; i < solidDatabaseModulesAsArray.length; i++) {
      const solidDatabaseModule = solidDatabaseModulesAsArray[i];
      const solidDatabaseModuleInstance: ISolidDatabaseModule = solidDatabaseModule.instance;
      if (solidDatabaseModuleInstance.name() === 'default') {
        return solidDatabaseModuleInstance;
      }
    }
  }

  getModules(): Array<InstanceWrapper> {
    return Array.from(this.modules);
  }

  getModule(name: string): InstanceWrapper {
    const module = this.getModules().filter((module) => module.name === name).pop();
    return module
  }

  getComputedFieldMetadata(): ComputedFieldMetadata[] {
    return this.computedFieldMetadata;
  }

  //TODO:getlocales from locale model and return default locale where isDefault:true 
  getDefaultLocale(): Locale | null {
    return this.locales.find(locale => locale.isDefault === true) || null;
  }

  getSecurityRules(modelSingularName: string, roleNames: string[] = []): SecurityRule[] {
    // If no role is provided, return all security rules for the model
    if (roleNames.length === 0) {
      return this.securityRules.filter((rule) => rule.modelMetadata.singularName === modelSingularName);
    }
    // If roles are provided, filter the security rules by model and roles
    return this.securityRules.filter((rule) => {
      return rule.modelMetadata.singularName === modelSingularName && roleNames.includes(rule.role.name);
    });
  }

  registerAuditableModels(models: Set<string>): void {
    this.auditableModels = models;
  }

  isAuditableModel(modelSingularName: string): boolean {
    return this.auditableModels.has(modelSingularName.toLowerCase());
  }

  getCommonEntityKeys(): (keyof CommonEntity | 'createdBy' | 'updatedBy')[] {
    return ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'updatedBy', 'deletedTracker', 'localeName', 'defaultEntityLocaleId', 'publishedAt'];
    // return Reflect.getMetadataKeys(CommonEntity.prototype) as (keyof CommonEntity)[];
  }


  getAllSettingsProviderInstance<T extends ISelectionProviderContext>(): ISelectionProvider<T> {
    const settingsProviders = this.getSettingsProviders();

    for (let i = 0; i < settingsProviders.length; i++) {
      const settingsProvider = settingsProviders[i];
      return settingsProvider.instance;
    }
  }
}
