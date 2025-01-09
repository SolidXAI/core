import { Injectable } from '@nestjs/common';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { ISelectionProvider, ISelectionProviderContext } from "../interfaces";

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
}

@Injectable()
export class SolidRegistry {
  private seeders: Set<InstanceWrapper> = new Set();
  private selectionProviders: Set<InstanceWrapper> = new Set();
  private computedFieldProviders: Set<InstanceWrapper> = new Set();
  private solidDatabaseModules: Set<InstanceWrapper> = new Set();
  private controllers: Set<ControllerMetadata> = new Set();
  private modules : Set<InstanceWrapper> = new Set();

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

  registerComputedFieldProvider(computedFieldProvider: InstanceWrapper): void {
    this.computedFieldProviders.add(computedFieldProvider);
  }

  registerSolidDatabaseModule(solidDatabaseModule: InstanceWrapper): void {
    this.solidDatabaseModules.add(solidDatabaseModule);
  }

  registerModules(modules: InstanceWrapper[]): void {
    this.modules = new Set(modules);
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

  getComputedFieldProviders(): Array<InstanceWrapper> {
    return Array.from(this.computedFieldProviders);
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
}