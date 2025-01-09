"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolidDatabaseModule = exports.IS_SOLID_DATABASE_MODULE = void 0;
exports.IS_SOLID_DATABASE_MODULE = 'IS_SOLID_DATABASE_MODULE';
const SolidDatabaseModule = () => {
    return (target) => {
        Reflect.defineMetadata(exports.IS_SOLID_DATABASE_MODULE, true, target);
    };
};
exports.SolidDatabaseModule = SolidDatabaseModule;
//# sourceMappingURL=solid-database-module.decorator.js.map