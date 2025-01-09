"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolidRegistry = exports.RESERVED_SOLID_KEYWORDS = void 0;
const common_1 = require("@nestjs/common");
var RESERVED_SOLID_KEYWORDS;
(function (RESERVED_SOLID_KEYWORDS) {
    RESERVED_SOLID_KEYWORDS["moduleMetadata"] = "moduleMetadata";
    RESERVED_SOLID_KEYWORDS["modelMetadata"] = "modelMetadata";
    RESERVED_SOLID_KEYWORDS["fieldMetadata"] = "fieldMetadata";
    RESERVED_SOLID_KEYWORDS["dataSource"] = "dataSource";
    RESERVED_SOLID_KEYWORDS["repository"] = "repository";
    RESERVED_SOLID_KEYWORDS["entityManager"] = "entityManager";
})(RESERVED_SOLID_KEYWORDS || (exports.RESERVED_SOLID_KEYWORDS = RESERVED_SOLID_KEYWORDS = {}));
let SolidRegistry = class SolidRegistry {
    constructor() {
        this.seeders = new Set();
        this.selectionProviders = new Set();
        this.computedFieldProviders = new Set();
        this.solidDatabaseModules = new Set();
        this.controllers = new Set();
        this.modules = new Set();
    }
    registerController(name, methodNames) {
        this.controllers.add({ name: name, methods: methodNames });
    }
    registerControllers(controllers) {
        this.controllers = controllers;
    }
    registerSeeder(seeder) {
        this.seeders.add(seeder);
    }
    registerSelectionProvider(selectionProvider) {
        this.selectionProviders.add(selectionProvider);
    }
    registerComputedFieldProvider(computedFieldProvider) {
        this.computedFieldProviders.add(computedFieldProvider);
    }
    registerSolidDatabaseModule(solidDatabaseModule) {
        this.solidDatabaseModules.add(solidDatabaseModule);
    }
    registerModules(modules) {
        this.modules = new Set(modules);
    }
    getSeeders() {
        return Array.from(this.seeders);
    }
    getControllers() {
        return Array.from(this.controllers);
    }
    getSelectionProviders() {
        return Array.from(this.selectionProviders);
    }
    getSelectionProviderInstance(name) {
        const selectionProviders = this.getSelectionProviders();
        for (let i = 0; i < selectionProviders.length; i++) {
            const selectionProvider = selectionProviders[i];
            if (selectionProvider.instance.name() === name) {
                return selectionProvider.instance;
            }
        }
    }
    getComputedFieldProviders() {
        return Array.from(this.computedFieldProviders);
    }
    getSolidDatabaseModules() {
        return Array.from(this.solidDatabaseModules);
    }
    getModules() {
        return Array.from(this.modules);
    }
    getModule(name) {
        const module = this.getModules().filter((module) => module.name === name).pop();
        return module;
    }
};
exports.SolidRegistry = SolidRegistry;
exports.SolidRegistry = SolidRegistry = __decorate([
    (0, common_1.Injectable)()
], SolidRegistry);
//# sourceMappingURL=solid-registry.js.map