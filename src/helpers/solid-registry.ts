import { Injectable } from '@nestjs/common';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { CommonEntity } from 'src/entities/common.entity';
import { SecurityRule } from 'src/entities/security-rule.entity';
import { EntityManager } from 'typeorm';
import { ISelectionProvider, ISelectionProviderContext } from "../interfaces";
import { Locale } from 'src/entities/locale.entity';

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

@Injectable()
export class SolidRegistry {
  private seeders: Set<InstanceWrapper> = new Set();
  private selectionProviders: Set<InstanceWrapper> = new Set();
  private computedFieldProviders: Set<InstanceWrapper> = new Set();
  private solidDatabaseModules: Set<InstanceWrapper> = new Set();
  private controllers: Set<ControllerMetadata> = new Set();
  private modules: Set<InstanceWrapper> = new Set();
  private securityRules: SecurityRule[] = [];
  private locales : Locale[] = [];

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

  registerSecurityRules(securityRules: SecurityRule[]) {
    this.securityRules = securityRules;
  }

  registerlocales(locales : Locale[]){
    this.locales = locales;
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

  // Returns the entity target class from the entity name
  getEntityTarget(entityManager: EntityManager, entityName: string): any { //TODO Can be refactored to use this function from crud helper service
    const entityMetadatas = entityManager.connection.entityMetadatas;
    const entityMetadata = entityMetadatas.find(em => em.name === entityName);
    return entityMetadata.target;
  }

  getCommonEntityKeys(): (keyof CommonEntity) [] {
    return [ 'id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'updatedBy', 'deletedTracker', 'localeName', 'defaultEntityLocaleId', 'publishedAt'];
        // return Reflect.getMetadataKeys(CommonEntity.prototype) as (keyof CommonEntity)[];
  }

}