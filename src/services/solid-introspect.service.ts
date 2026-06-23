import { classify } from '../helpers/string.helper';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, ModuleRef, Reflector } from '@nestjs/core';
import { ModelMetadataHelperService } from 'src/helpers/model-metadata-helper.service';
import { ModelMetadataRepository } from 'src/repository/model-metadata.repository';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { getDataSourceToken } from '@nestjs/typeorm';
import { IS_COMPUTED_FIELD_PROVIDER } from 'src/decorators/computed-field-provider.decorator';
import { IS_ERROR_CODE_PROVIDER } from 'src/decorators/error-codes-provider.decorator';
import { IS_MAIL_PROVIDER } from 'src/decorators/mail-provider.decorator';
import { IS_SCHEDULED_JOB_PROVIDER } from 'src/decorators/scheduled-job-provider.decorator';
import { IS_SECURITY_RULE_CONFIG_PROVIDER } from 'src/decorators/security-rule-config-provider.decorator';
import { IS_SELECTION_PROVIDER } from 'src/decorators/selection-provider.decorator';
import { IS_DASHBOARD_WIDGET_DATA_PROVIDER } from 'src/decorators/dashboard-widget-data-provider.decorator';
import { IS_EXTENSION_USER_CREATION_PROVIDER } from 'src/decorators/extension-user-creation-provider.decorator';
import { IS_SOLID_DATABASE_MODULE } from 'src/decorators/solid-database-module.decorator';
import { IS_WA_PROVIDER } from 'src/decorators/whatsapp-provider.decorator';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { AuditSubscriber } from 'src/subscribers/audit.subscriber';
import { ComputedEntityFieldSubscriber } from 'src/subscribers/computed-entity-field.subscriber';
import { CreatedByUpdatedBySubscriber } from 'src/subscribers/created-by-updated-by.subscriber';
import { SoftDeleteAwareEventSubscriber } from 'src/subscribers/soft-delete-aware-event.subscriber';
import { DataSource } from 'typeorm';
import { CRUDService } from './crud.service';
import { IS_SETTINGS_PROVIDER } from 'src/decorators/settings-provider.decorator';
import { IS_SMS_PROVIDER } from 'src/decorators/sms-provider.decorator';
import { IS_PUSH_NOTIFICATION_PROVIDER } from 'src/decorators/push-notification-provider.decorator';
import { SettingService } from 'src/services/setting.service';

export const coreSubscriberClasses = [
  AuditSubscriber,
  ComputedEntityFieldSubscriber,
  CreatedByUpdatedBySubscriber,
  SoftDeleteAwareEventSubscriber
];

@Injectable()
export class SolidIntrospectService implements OnApplicationBootstrap {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly metadataScanner: MetadataScanner,
    private readonly solidRegistry: SolidRegistry,
    private readonly moduleRef: ModuleRef,
    private readonly settingService: SettingService,
    private readonly modelMetadataRepo: ModelMetadataRepository,
    private readonly modelMetadataHelperService: ModelMetadataHelperService,
  ) { }

  private readonly logger = new Logger(SolidIntrospectService.name);

  async onApplicationBootstrap() {
    this.logger.debug('Introspecting the application for Solid metadata');

    // Register all seeders
    const seeders = this.discoveryService.getProviders().filter((provider) => this.isSeeder(provider));
    seeders.forEach((seeder) => {
      this.solidRegistry.registerSeeder(seeder);
    });

    // Register all IErrorCodeProvider implementations
    const errorCodeProviders = this.discoveryService.getProviders().filter((provider) => this.isErrorCodeProvider(provider));
    errorCodeProviders.forEach((errorCodeProvider) => {
      this.solidRegistry.registerErrorCodeProvider(errorCodeProvider);
    });

    // Register all ISelectionProvider implementations
    const selectionProviders = this.discoveryService.getProviders().filter((provider) => this.isSelectionProvider(provider));
    selectionProviders.forEach((selectionProvider) => {
      this.solidRegistry.registerSelectionProvider(selectionProvider);
    });

    // Register all IDashboardWidgetDataProvider implementations
    const dashboardWidgetDataProviders = this.discoveryService.getProviders().filter((provider) => this.isDashboardWidgetDataProvider(provider));
    dashboardWidgetDataProviders.forEach((provider) => {
      this.solidRegistry.registerDashboardWidgetDataProvider(provider);
    });

    // Register all ISettingsProvider implementations
    const settingsProviders = this.discoveryService.getProviders().filter((provider) => this.isSettingsProvider(provider));
    settingsProviders.forEach((settingsProvider) => {
      this.solidRegistry.registerSettingsProvider(settingsProvider);
    });

    // Register all IComputedProvider implementations
    const computedFieldProviders = this.discoveryService.getProviders().filter((provider) => this.isComputedFieldProvider(provider));
    computedFieldProviders.forEach((computedFieldProvider) => {
      this.solidRegistry.registerComputedFieldProvider(computedFieldProvider);
    });

    // Register all ISolidDatabaseModules implementations
    const solidDatabaseModules = this.discoveryService.getProviders().filter((provider) => this.isSolidDatabaseModule(provider));
    solidDatabaseModules.forEach((solidDatabaseModule) => {
      this.solidRegistry.registerSolidDatabaseModule(solidDatabaseModule);
    });

    // keep track of all the controllers & respective methods. 
    const allControllers = this.discoveryService.getControllers().map((controller) => {
      const { instance } = controller;
      return {
        name: controller.name,
        methods: this.metadataScanner.getAllMethodNames(Object.getPrototypeOf(instance))
      };
    });

    this.solidRegistry.registerControllers(new Set(allControllers));

    // Register all modules
    const allModules = this.discoveryService.getProviders().filter((provider) => this.isModule(provider));
    this.solidRegistry.registerModules(allModules);

    // Register all IScheduledJob implementations
    const scheduledJobProviders = this.discoveryService.getProviders().filter((provider) => this.isScheduledJobProvider(provider));
    scheduledJobProviders.forEach((scheduledJobProvider) => {
      this.solidRegistry.registerScheduledJobProvider(scheduledJobProvider);
    });

    // Register all IMail implementations
    const mailProviders = this.discoveryService.getProviders().filter((provider) => this.isMailProvider(provider));
    mailProviders.forEach((mailProvider) => {
      this.solidRegistry.registerMailProvider(mailProvider);
    });

    // Register all IWhatsappTransport implementations
    const whatsappProviders = this.discoveryService.getProviders().filter((provider) => this.isWhatsappProvider(provider));
    whatsappProviders.forEach((whatsappProvider) => {
      this.solidRegistry.registerWhatsappProvider(whatsappProvider);
    });

    // Register all IWhatsappTransport implementations
    const smsProviders = this.discoveryService.getProviders().filter((provider) => this.isSmsProvider(provider));
    smsProviders.forEach((smsProvider) => {
      this.solidRegistry.registerSmsProvider(smsProvider);
    });

    // Register all IPushNotification implementations
    const pushNotificationProviders = this.discoveryService.getProviders().filter((provider) => this.isPushNotificationProvider(provider));
    pushNotificationProviders.forEach((pushNotificationProvider) => {
      this.solidRegistry.registerPushNotificationProvider(pushNotificationProvider);
    });

    // Register all ISecurityRuleConfigProvider implementations
    const securityRuleConfigProviders = this.discoveryService.getProviders().filter((provider) => this.isSecurityRuleConfigProvider(provider));
    securityRuleConfigProviders.forEach((securityRuleConfigProvider) => {
      this.solidRegistry.registerSecurityRuleConfigProvider(securityRuleConfigProvider);
    });

    // Register IExtensionUserCreationProvider implementation (at most one per project)
    const extensionUserCreationProviders = this.discoveryService.getProviders().filter((provider) => this.isExtensionUserCreationProvider(provider));
    extensionUserCreationProviders.forEach((provider) => {
      this.solidRegistry.registerExtensionUserCreationProvider(provider);
    });

    // Register the core subscribers against all the configured database modules / datasources
    await this.bootstrapCoreTypeOrmSubscribers(solidDatabaseModules);
    await this.cacheAuditableModels();
    await this.settingService.updateSettingsCache();
  }

  private async cacheAuditableModels(): Promise<void> {
    const models = await this.modelMetadataRepo.find({
      where: { enableAuditTracking: true },
      relations: { fields: true, module: true },
    });

    const auditableSet = new Set<string>();
    for (const model of models) {
      const allFields = await this.modelMetadataHelperService.loadFieldHierarchy(model.singularName);
      const hasAuditableField = allFields.some(field =>
        field.enableAuditTracking &&
        !['mediaSingle', 'mediaMultiple', 'richText', 'json'].includes(field.type) &&
        !(field.type === 'relation' && field.relationType === 'one-to-many')
      );
      if (hasAuditableField) {
        auditableSet.add(model.singularName.toLowerCase());
      }
    }

    this.solidRegistry.registerAuditableModels(auditableSet);
    this.logger.debug(`Cached ${auditableSet.size} auditable model(s): ${[...auditableSet].join(', ')}`);
  }

  async bootstrapCoreTypeOrmSubscribers(dbModules: Array<InstanceWrapper<any>>): Promise<void> {
    // Register core subscribers for each Solid database module
    for (const wrapper of dbModules) {
      // Get the Database Module instance
      const instance = (wrapper as InstanceWrapper).instance as any;
      if (!instance || typeof instance.name !== 'function') {
        this.logger.warn('Skipping a solid DB module wrapper with no instance or name() method');
        continue;
      }

      // Get the DataSource for this module
      const dsName: string | undefined = instance.name();
      // getDataSourceToken() without name = default; pass dsName if non-default
      const token = dsName ? getDataSourceToken(dsName) : getDataSourceToken();
      let ds: DataSource | undefined;
      try {
        ds = this.moduleRef.get<DataSource>(token, { strict: false });
      } catch (err: any) {
        this.logger.warn(`DataSource token for "${dsName ?? 'default'}" not found: ${err?.message ?? err}`);
      }
      if (!ds) {
        this.logger.warn(`No DataSource found for module "${dsName}". Skipping subscriber registration.`);
        continue;
      }

      // Ensure DataSource is initialized (optional)
      if (!ds.isInitialized) {
        try {
          await ds.initialize(); // only if you need to initialize here; in many apps datasources are created earlier
        } catch (err: any) {
          this.logger.error(`Failed to initialize DataSource "${dsName}": ${err}`);
          continue;
        }
      }

      // Register each subscriber class for this DataSource
      // const auditSubscriberInstance = new AuditSubscriber(this.chatterMessageService, this.modelMetadataRepo, this.modelMetadataHelperService);
      // auditSubscriberInstance.bindToDataSource(ds);

      // const computedEntityFieldSubscriberInstance = new ComputedEntityFieldSubscriber(this.solidRegistry, this.publisherFactory);
      // computedEntityFieldSubscriberInstance.bindToDataSource(ds);

      // const createdByUpdatedBySubscriberInstance = new CreatedByUpdatedBySubscriber(this.requestContextService);
      // createdByUpdatedBySubscriberInstance.bindToDataSource(ds);

      // const softDeleteAwareEventSubscriberInstance = new SoftDeleteAwareEventSubscriber();
      // softDeleteAwareEventSubscriberInstance.bindToDataSource(ds);
      for (const SubClass of coreSubscriberClasses) {
        const alreadyRegistered = ds.subscribers.some(
          (s) => (s as any).constructor?.name === SubClass.name,
        );
        if (alreadyRegistered) {
          this.logger.debug(`Subscriber ${SubClass.name} already registered on datasource ${dsName ?? 'default'}`);
          continue;
        }

        // Resolve subscriber from NestJS moduleRef to ensure dependencies are injected
        const subscriberInstance = await this.moduleRef.resolve(SubClass, undefined, { strict: false });
        subscriberInstance.bindToDataSource(ds);

        // instantiate subscriber bound to this DataSource
        // NOTE: constructor signature must be (dataSource: DataSource, requestContextService: RequestContextService, ...)
        // const subscriberInstance = new (SubClass as any)(ds, this.requestContextService);

        // ds.subscribers.push(subscriberInstance);
        // this.logger.log(`Registered subscriber ${SubClass.name} on datasource ${dsName ?? 'default'}`);
      }
    }
  }

  // This method identifies a provider as a seeder if it has a seed method i.e duck typing
  private isSeeder(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const seedMethod = this.metadataScanner.getAllMethodNames(Object.getPrototypeOf(instance)).find((methodName) => methodName === 'seed');
    if (!seedMethod) return false;
    return true;
  }

  private isErrorCodeProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isErrorCodeProvider = this.reflector.get<boolean>(
      IS_ERROR_CODE_PROVIDER,
      instance.constructor,
    );

    return !!isErrorCodeProvider;
  }

  private isSelectionProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isSelectionProvider = this.reflector.get<boolean>(
      IS_SELECTION_PROVIDER,
      instance.constructor,
    );

    return !!isSelectionProvider;
  }

  private isDashboardWidgetDataProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isDashboardWidgetDataProvider = this.reflector.get<boolean>(
      IS_DASHBOARD_WIDGET_DATA_PROVIDER,
      instance.constructor,
    );

    return !!isDashboardWidgetDataProvider;
  }

  private isExtensionUserCreationProvider(provider: InstanceWrapper): boolean {
    const { instance } = provider;
    if (!instance) return false;
    return !!this.reflector.get<boolean>(IS_EXTENSION_USER_CREATION_PROVIDER, instance.constructor);
  }

  private isSettingsProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isSettingsProvider = this.reflector.get<boolean>(
      IS_SETTINGS_PROVIDER,
      instance.constructor,
    );

    return !!isSettingsProvider;
  }

  private isComputedFieldProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isComputedFieldProvider = this.reflector.get<boolean>(
      IS_COMPUTED_FIELD_PROVIDER,
      instance.constructor,
    );

    return !!isComputedFieldProvider;
  }

  private isScheduledJobProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isScheduledJobProvider = this.reflector.get<boolean>(
      IS_SCHEDULED_JOB_PROVIDER,
      instance.constructor,
    );

    return !!isScheduledJobProvider;
  }

  private isSolidDatabaseModule(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isSolidDatabaseModule = this.reflector.get<boolean>(
      IS_SOLID_DATABASE_MODULE,
      instance.constructor,
    );

    return !!isSolidDatabaseModule;
  }

  private isMailProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isMailProvider = this.reflector.get<boolean>(
      IS_MAIL_PROVIDER,
      instance.constructor,
    );

    return !!isMailProvider;
  }

  private isWhatsappProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isWhatsappProvider = this.reflector.get<boolean>(
      IS_WA_PROVIDER,
      instance.constructor,
    );

    return !!isWhatsappProvider;
  }

  private isSmsProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isSmsProvider = this.reflector.get<boolean>(
      IS_SMS_PROVIDER,
      instance.constructor,
    );

    return !!isSmsProvider;
  }

  private isPushNotificationProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isPushNotificationProvider = this.reflector.get<boolean>(
      IS_PUSH_NOTIFICATION_PROVIDER,
      instance.constructor,
    );

    return !!isPushNotificationProvider;
  }

  private isSecurityRuleConfigProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isSecurityRuleConfigProvider = this.reflector.get<boolean>(
      IS_SECURITY_RULE_CONFIG_PROVIDER,
      instance.constructor,
    );

    return !!isSecurityRuleConfigProvider;
  }

  private isModule(provider: InstanceWrapper): boolean {
    const metatype = provider.metatype;
    // Check if it's a Static Module (Class-Based)
    if (metatype && typeof metatype === 'function' && Reflect.getMetadata('imports', metatype)) {
      return true;
    }

    // Ensure provider.instance is an object before checking for 'module'
    if (provider.instance && typeof provider.instance === 'object') {
      // Check if it's a Dynamic Module (Object-Based)
      if ('module' in provider.instance && typeof provider.instance.module === 'function') {
        return true;
      }
    }

    return false;
  }

  /**
   * Given a model singular name this will return the crud service instance.
   * @param modelSingularName 
   * @returns 
   */
  getCRUDService(modelSingularName: string): CRUDService<any> {
    const provider = this.getProvider(`${classify(modelSingularName)}Service`);
    return provider?.instance as CRUDService<any>;
  }

  getProvider(providerName: string) {
    return this.discoveryService.getProviders().find((provider) => provider.name === providerName);
  }
}
