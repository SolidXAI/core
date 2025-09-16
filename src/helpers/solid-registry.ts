import { Injectable } from '@nestjs/common';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { ComputedFieldTriggerConfig, ComputedFieldValueType } from 'src/dtos/create-field-metadata.dto';
import { CommonEntity } from 'src/entities/common.entity';
import { Locale } from 'src/entities/locale.entity';
import { SecurityRule } from 'src/entities/security-rule.entity';
import { IScheduledJob } from 'src/services/scheduled-jobs/scheduled-job.interface';
import { IDashboardQuestionDataProvider, IDashboardVariableSelectionProvider, IErrorCodeProvider, ISelectionProvider, ISelectionProviderContext } from "../interfaces";

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
  userPasswordHistory = "userPasswordHistory",
  userMetadata = "userMetadata",
  user = "user",
  locale = "locale"
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
}

@Injectable()
export class SolidRegistry {
  private seeders: Set<InstanceWrapper> = new Set();
  private scheduledJobProviders: Set<InstanceWrapper> = new Set();
  private selectionProviders: Set<InstanceWrapper> = new Set();
  private computedFieldProviders: Set<InstanceWrapper> = new Set();
  private solidDatabaseModules: Set<InstanceWrapper> = new Set();
  private controllers: Set<ControllerMetadata> = new Set();
  private modules: Set<InstanceWrapper> = new Set();
  private securityRules: SecurityRule[] = [];
  private locales: Locale[] = [];
  private computedFieldMetadata: ComputedFieldMetadata[] = [];
  private dashboardVariableSelectionProviders: Set<InstanceWrapper> = new Set();
  private dashboardQuestionDataProviders: Set<InstanceWrapper> = new Set();
  private mailProviders: Set<InstanceWrapper> = new Set();
  private whatsappProviders: Set<InstanceWrapper> = new Set();
  private errorCodeProviders: Set<InstanceWrapper> = new Set();


  registerErrorCodeProvider(errorCodeProvider: InstanceWrapper): void {
    this.errorCodeProviders.add(errorCodeProvider);
  }

  registerWhatsappProvider(whatsappProvider: InstanceWrapper): void {
    this.whatsappProviders.add(whatsappProvider);
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

  registerDashboardVariableSelectionProvider(dashboardSelectionProvider: InstanceWrapper): void {
    this.dashboardVariableSelectionProviders.add(dashboardSelectionProvider);
  }

  registerDashboardQuestionDataProvider(dashboardQuestionDataProvider: InstanceWrapper): void {
    this.dashboardQuestionDataProviders.add(dashboardQuestionDataProvider);
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

  getMailProviders(): Array<InstanceWrapper> {
    return Array.from(this.mailProviders);
  }

  getWhatsappProviders(): Array<InstanceWrapper> {
    return Array.from(this.whatsappProviders);
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

  getSelectionProviderInstance<T extends ISelectionProviderContext>(name: string): ISelectionProvider<T> {
    const selectionProviders = this.getSelectionProviders();

    for (let i = 0; i < selectionProviders.length; i++) {
      const selectionProvider = selectionProviders[i];
      if (selectionProvider.instance.name() === name) {
        return selectionProvider.instance;
      }
    }
  }

  getDashboardVariableSelectionProviders(): Array<InstanceWrapper> {
    return Array.from(this.dashboardVariableSelectionProviders);
  }

  getDashboardVariableSelectionProviderInstance<T extends ISelectionProviderContext>(name: string): IDashboardVariableSelectionProvider<T> {
    const dashboardSelectionProviders = this.getDashboardVariableSelectionProviders();

    for (let i = 0; i < dashboardSelectionProviders.length; i++) {
      const dashboardSelectionProvider = dashboardSelectionProviders[i];
      if (dashboardSelectionProvider.instance.name() === name) {
        return dashboardSelectionProvider.instance;
      }
    }
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

  getDashboardQuestionDataProviders(): Array<InstanceWrapper> {
    return Array.from(this.dashboardQuestionDataProviders)
  }

  getDashboardQuestionDataProviderInstance<TContext, TData>(name: string): IDashboardQuestionDataProvider<TContext, TData> {
    const dashboardQuestionDataProviders = this.getDashboardQuestionDataProviders();

    for (let i = 0; i < dashboardQuestionDataProviders.length; i++) {
      const dasbhoardQuestionDataProvider = dashboardQuestionDataProviders[i];
      if (dasbhoardQuestionDataProvider.instance.name() === name) {
        return dasbhoardQuestionDataProvider.instance;
      }
    }

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

  getModules(): Array<InstanceWrapper> {
    return Array.from(this.modules);
  }

  getModule(name: string): InstanceWrapper {
    const module = this.getModules().filter((module) => module.name === name).pop();
    return module
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

  getCommonEntityKeys(): (keyof CommonEntity)[] {
    return ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'updatedBy', 'deletedTracker', 'localeName', 'defaultEntityLocaleId', 'publishedAt'];
    // return Reflect.getMetadataKeys(CommonEntity.prototype) as (keyof CommonEntity)[];
  }

}