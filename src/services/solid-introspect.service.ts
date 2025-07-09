import { classify } from '@angular-devkit/core/src/utils/strings';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { IS_COMPUTED_FIELD_PROVIDER } from 'src/decorators/computed-field-provider.decorator';
import { IS_SELECTION_PROVIDER } from 'src/decorators/selection-provider.decorator';
import { IS_SOLID_DATABASE_MODULE } from 'src/decorators/solid-database-module.decorator';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { CRUDService } from './crud.service';
import { IS_SCHEDULED_JOB_PROVIDER } from 'src/decorators/scheduled-job-provider.decorator';
import { IS_DASHBOARD_VARIABLE_SELECTION_PROVIDER } from 'src/decorators/dashboard-selection-provider.decorator';
import { IS_DASHBOARD_QUESTION_DATA_PROVIDER } from 'src/decorators/dashboard-question-data-provider.decorator';

@Injectable()
export class SolidIntrospectService implements OnApplicationBootstrap {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly metadataScanner: MetadataScanner,
    private readonly solidRegistry: SolidRegistry,
  ) { }

  private readonly logger = new Logger(SolidIntrospectService.name);
  onApplicationBootstrap() {
    this.logger.log('Introspecting the application for Solid metadata');

    // Register all seeders
    const seeders = this.discoveryService
      .getProviders()
      .filter((provider) => this.isSeeder(provider));
    seeders.forEach((seeder) => {
      this.solidRegistry.registerSeeder(seeder);
    });

    // TODO: Scan the filesystem and populate the solid metadata

    // Register all ISelectionProvider implementations
    const selectionProviders = this.discoveryService
      .getProviders()
      .filter((provider) => this.isSelectionProvider(provider));

    selectionProviders.forEach((selectionProvider) => {
      // @ts-ignore
      this.solidRegistry.registerSelectionProvider(selectionProvider);
    });

    // Register all IDashboardSelectionProvider implementations
    const dashboardVariableSelectionProviders = this.discoveryService
      .getProviders()
      .filter((provider) => this.isDashboardVariableSelectionProvider(provider));

    dashboardVariableSelectionProviders.forEach((dashboardSelectionProvider) => {
      // @ts-ignore
      this.solidRegistry.registerDashboardVariableSelectionProvider(dashboardSelectionProvider);
    });

    // Register all IDashboardSelectionProvider implementations
    const dashboardQuestionDataProviders = this.discoveryService
      .getProviders()
      .filter((provider) => this.isDashboardQuestionDataProvider(provider));

    dashboardQuestionDataProviders.forEach((provider) => {
      // @ts-ignore
      this.solidRegistry.registerDashboardQuestionDataProvider(provider);
    });


    // Register all IComputedProvider implementations
    const computedFieldProviders = this.discoveryService
      .getProviders()
      .filter((provider) => this.isComputedFieldProvider(provider));

    computedFieldProviders.forEach((computedFieldProvider) => {
      // @ts-ignore
      this.solidRegistry.registerComputedFieldProvider(computedFieldProvider);
    });

    // Register all ISolidDatabaseModules implementations
    const solidDatabaseModules = this.discoveryService
      .getProviders()
      .filter((provider) => this.isSolidDatabaseModule(provider));

    solidDatabaseModules.forEach((solidDatabaseModule) => {
      // @ts-ignore
      this.solidRegistry.registerSolidDatabaseModule(solidDatabaseModule);
    });

    // keep track of all the controllers & respective methods. 
    const allControllers = this.discoveryService
      .getControllers()
      .map((controller) => {
        const { instance } = controller;
        return {
          name: controller.name,
          methods: this.metadataScanner.getAllMethodNames(Object.getPrototypeOf(instance))
        };
      });

    this.solidRegistry.registerControllers(new Set(allControllers));

    // Register all modules
    const allModules = this.discoveryService
      .getProviders()
      .filter((provider) => this.isModule(provider));
    this.solidRegistry.registerModules(allModules);

    // Register all IScheduledJob implementations
    const scheduledJobProviders = this.discoveryService
      .getProviders()
      .filter((provider) => this.isScheduledJobProvider(provider));

    scheduledJobProviders.forEach((scheduledJobProvider) => {
      // @ts-ignore
      this.solidRegistry.registerScheduledJobProvider(scheduledJobProvider);
    });

  }

  isDashboardQuestionDataProvider(providerWrapper: InstanceWrapper<any>) {
    const { instance } = providerWrapper;
    if (!instance) return false;
    const provider = this.reflector.get<boolean>(
      IS_DASHBOARD_QUESTION_DATA_PROVIDER,
      instance.constructor,
    );
    return !!provider;
  }

  // This method identifies a provider as a seeder if it has a seed method i.e duck typing
  private isSeeder(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const seedMethod = this.metadataScanner
      .getAllMethodNames(Object.getPrototypeOf(instance))
      .find((methodName) => methodName === 'seed');
    if (!seedMethod) return false;
    return true;
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

  private isDashboardVariableSelectionProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;
    const isDashboardSelectionProvider = this.reflector.get<boolean>(
      IS_DASHBOARD_VARIABLE_SELECTION_PROVIDER,
      instance.constructor,
    );
    return !!isDashboardSelectionProvider;
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
