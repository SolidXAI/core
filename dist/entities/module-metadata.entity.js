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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleMetadata = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const model_metadata_entity_1 = require("./model-metadata.entity");
let ModuleMetadata = class ModuleMetadata extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { displayName: { required: true, type: () => String }, name: { required: true, type: () => String }, description: { required: true, type: () => String }, menuIconUrl: { required: true, type: () => String }, menuSequenceNumber: { required: true, type: () => Number }, defaultDataSource: { required: true, type: () => String }, models: { required: true, type: () => [require("./model-metadata.entity").ModelMetadata] }, isSystem: { required: true, type: () => Boolean } };
    }
};
exports.ModuleMetadata = ModuleMetadata;
__decorate([
    (0, typeorm_1.Column)({ name: "display_name" }),
    __metadata("design:type", String)
], ModuleMetadata.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ name: "name" }),
    __metadata("design:type", String)
], ModuleMetadata.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ModuleMetadata.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ModuleMetadata.prototype, "menuIconUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], ModuleMetadata.prototype, "menuSequenceNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ModuleMetadata.prototype, "defaultDataSource", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => model_metadata_entity_1.ModelMetadata, (model) => model.module),
    __metadata("design:type", Array)
], ModuleMetadata.prototype, "models", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ModuleMetadata.prototype, "isSystem", void 0);
exports.ModuleMetadata = ModuleMetadata = __decorate([
    (0, typeorm_1.Entity)("ss_module_metadata")
], ModuleMetadata);
//# sourceMappingURL=module-metadata.entity.js.map