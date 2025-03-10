import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { IS_COMPUTED_FIELD_PROVIDER } from 'src/decorators/computed-field-provider.decorator';
import { IS_SELECTION_PROVIDER } from 'src/decorators/selection-provider.decorator';
import { IS_SOLID_DATABASE_MODULE } from 'src/decorators/solid-database-module.decorator';
import { SolidRegistry } from 'src/helpers/solid-registry';

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

  private isComputedFieldProvider(provider: InstanceWrapper) {
    const { instance } = provider;
    if (!instance) return false;

    const isComputedFieldProvider = this.reflector.get<boolean>(
      IS_COMPUTED_FIELD_PROVIDER,
      instance.constructor,
    );

    return !!isComputedFieldProvider;
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

}
