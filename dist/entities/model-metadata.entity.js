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
exports.ModelMetadata = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const field_metadata_entity_1 = require("./field-metadata.entity");
const module_metadata_entity_1 = require("./module-metadata.entity");
let ModelMetadata = class ModelMetadata extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { singularName: { required: true, type: () => String }, tableName: { required: true, type: () => String }, pluralName: { required: true, type: () => String }, displayName: { required: true, type: () => String }, description: { required: true, type: () => String }, dataSource: { required: true, type: () => String }, dataSourceType: { required: true, type: () => String }, enableSoftDelete: { required: true, type: () => Boolean }, enableAuditTracking: { required: true, type: () => Boolean }, internationalisation: { required: true, type: () => Boolean }, fields: { required: true, type: () => [require("./field-metadata.entity").FieldMetadata] }, module: { required: true, type: () => require("./module-metadata.entity").ModuleMetadata }, isExportable: { required: true, type: () => Boolean }, userKeyField: { required: true, type: () => require("./field-metadata.entity").FieldMetadata }, isSystem: { required: true, type: () => Boolean } };
    }
};
exports.ModelMetadata = ModelMetadata;
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ name: "singular_name" }),
    __metadata("design:type", String)
], ModelMetadata.prototype, "singularName", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ name: "table_name", nullable: true }),
    __metadata("design:type", String)
], ModelMetadata.prototype, "tableName", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ name: "plural_name" }),
    __metadata("design:type", String)
], ModelMetadata.prototype, "pluralName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "display_name" }),
    __metadata("design:type", String)
], ModelMetadata.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "description", nullable: true }),
    __metadata("design:type", String)
], ModelMetadata.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "data_source" }),
    __metadata("design:type", String)
], ModelMetadata.prototype, "dataSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "data_source_type" }),
    __metadata("design:type", String)
], ModelMetadata.prototype, "dataSourceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "enable_soft_delete", default: true }),
    __metadata("design:type", Boolean)
], ModelMetadata.prototype, "enableSoftDelete", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "enable_audit_tracking", default: false }),
    __metadata("design:type", Boolean)
], ModelMetadata.prototype, "enableAuditTracking", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "internationalisation", default: false }),
    __metadata("design:type", Boolean)
], ModelMetadata.prototype, "internationalisation", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => field_metadata_entity_1.FieldMetadata, (field) => field.model),
    __metadata("design:type", Array)
], ModelMetadata.prototype, "fields", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => module_metadata_entity_1.ModuleMetadata, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'module_id', referencedColumnName: 'id' }),
    __metadata("design:type", module_metadata_entity_1.ModuleMetadata)
], ModelMetadata.prototype, "module", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_exportable", default: false }),
    __metadata("design:type", Boolean)
], ModelMetadata.prototype, "isExportable", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => field_metadata_entity_1.FieldMetadata, { onDelete: 'SET NULL' }),
    __metadata("design:type", field_metadata_entity_1.FieldMetadata)
], ModelMetadata.prototype, "userKeyField", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ModelMetadata.prototype, "isSystem", void 0);
exports.ModelMetadata = ModelMetadata = __decorate([
    (0, typeorm_1.Entity)("ss_model_metadata")
], ModelMetadata);
//# sourceMappingURL=model-metadata.entity.js.map