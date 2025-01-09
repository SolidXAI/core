"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SolidIntrospectService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolidIntrospectService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const computed_field_provider_decorator_1 = require("../decorators/computed-field-provider.decorator");
const selection_provider_decorator_1 = require("../decorators/selection-provider.decorator");
const solid_database_module_decorator_1 = require("../decorators/solid-database-module.decorator");
const solid_registry_1 = require("../helpers/solid-registry");
let SolidIntrospectService = SolidIntrospectService_1 = class SolidIntrospectService {
    constructor(discoveryService, reflector, metadataScanner, solidRegistry) {
        this.discoveryService = discoveryService;
        this.reflector = reflector;
        this.metadataScanner = metadataScanner;
        this.solidRegistry = solidRegistry;
        this.logger = new common_1.Logger(SolidIntrospectService_1.name);
    }
    onApplicationBootstrap() {
        this.logger.log('Introspecting the application for Solid metadata');
        const seeders = this.discoveryService
            .getProviders()
            .filter((provider) => this.isSeeder(provider));
        seeders.forEach((seeder) => {
            this.solidRegistry.registerSeeder(seeder);
        });
        const selectionProviders = this.discoveryService
            .getProviders()
            .filter((provider) => this.isSelectionProvider(provider));
        selectionProviders.forEach((selectionProvider) => {
            this.solidRegistry.registerSelectionProvider(selectionProvider);
        });
        const computedFieldProviders = this.discoveryService
            .getProviders()
            .filter((provider) => this.isComputedFieldProvider(provider));
        computedFieldProviders.forEach((computedFieldProvider) => {
            this.solidRegistry.registerComputedFieldProvider(computedFieldProvider);
        });
        const solidDatabaseModules = this.discoveryService
            .getProviders()
            .filter((provider) => this.isSolidDatabaseModule(provider));
        solidDatabaseModules.forEach((solidDatabaseModule) => {
            this.solidRegistry.registerSolidDatabaseModule(solidDatabaseModule);
        });
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
        const allModules = this.discoveryService
            .getProviders()
            .filter((provider) => this.isModule(provider));
        this.solidRegistry.registerModules(allModules);
    }
    isSeeder(provider) {
        const { instance } = provider;
        if (!instance)
            return false;
        const seedMethod = this.metadataScanner
            .getAllMethodNames(Object.getPrototypeOf(instance))
            .find((methodName) => methodName === 'seed');
        if (!seedMethod)
            return false;
        return true;
    }
    isSelectionProvider(provider) {
        const { instance } = provider;
        if (!instance)
            return false;
        const isSelectionProvider = this.reflector.get(selection_provider_decorator_1.IS_SELECTION_PROVIDER, instance.constructor);
        return !!isSelectionProvider;
    }
    isComputedFieldProvider(provider) {
        const { instance } = provider;
        if (!instance)
            return false;
        const isComputedFieldProvider = this.reflector.get(computed_field_provider_decorator_1.IS_COMPUTED_FIELD_PROVIDER, instance.constructor);
        return !!isComputedFieldProvider;
    }
    isSolidDatabaseModule(provider) {
        const { instance } = provider;
        if (!instance)
            return false;
        const isSolidDatabaseModule = this.reflector.get(solid_database_module_decorator_1.IS_SOLID_DATABASE_MODULE, instance.constructor);
        return !!isSolidDatabaseModule;
    }
    isModule(provider) {
        const metatype = provider.metatype;
        return metatype && Reflect.getMetadata('imports', metatype);
    }
};
exports.SolidIntrospectService = SolidIntrospectService;
exports.SolidIntrospectService = SolidIntrospectService = SolidIntrospectService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.DiscoveryService,
        core_1.Reflector,
        core_1.MetadataScanner,
        solid_registry_1.SolidRegistry])
], SolidIntrospectService);
//# sourceMappingURL=solid-introspect.service.js.map