import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { ISelectionProvider, ISelectionProviderContext } from "../interfaces";
type ControllerMetadata = {
    name: string;
    methods: string[];
};
export declare enum RESERVED_SOLID_KEYWORDS {
    moduleMetadata = "moduleMetadata",
    modelMetadata = "modelMetadata",
    fieldMetadata = "fieldMetadata",
    dataSource = "dataSource",
    repository = "repository",
    entityManager = "entityManager"
}
export declare class SolidRegistry {
    private seeders;
    private selectionProviders;
    private computedFieldProviders;
    private solidDatabaseModules;
    private controllers;
    private modules;
    registerController(name: string, methodNames: string[]): void;
    registerControllers(controllers: Set<ControllerMetadata>): void;
    registerSeeder(seeder: InstanceWrapper): void;
    registerSelectionProvider(selectionProvider: InstanceWrapper): void;
    registerComputedFieldProvider(computedFieldProvider: InstanceWrapper): void;
    registerSolidDatabaseModule(solidDatabaseModule: InstanceWrapper): void;
    registerModules(modules: InstanceWrapper[]): void;
    getSeeders(): Array<InstanceWrapper>;
    getControllers(): ControllerMetadata[];
    getSelectionProviders(): Array<InstanceWrapper>;
    getSelectionProviderInstance<T extends ISelectionProviderContext>(name: string): ISelectionProvider<T>;
    getComputedFieldProviders(): Array<InstanceWrapper>;
    getSolidDatabaseModules(): Array<InstanceWrapper>;
    getModules(): Array<InstanceWrapper>;
    getModule(name: string): InstanceWrapper;
}
export {};
