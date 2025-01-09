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
exports.FieldMetadata = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const media_storage_provider_metadata_entity_1 = require("./media-storage-provider-metadata.entity");
const model_metadata_entity_1 = require("./model-metadata.entity");
let FieldMetadata = class FieldMetadata extends common_entity_1.CommonEntity {
    constructor() {
        super(...arguments);
        this.selectionValueType = 'string';
    }
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, displayName: { required: true, type: () => String }, description: { required: true, type: () => String }, type: { required: true, type: () => String }, ormType: { required: true, type: () => String }, model: { required: true, type: () => require("./model-metadata.entity").ModelMetadata }, defaultValue: { required: true, type: () => String }, regexPattern: { required: true, type: () => String }, regexPatternNotMatchingErrorMsg: { required: true, type: () => String }, required: { required: true, type: () => Boolean }, unique: { required: true, type: () => Boolean }, encrypt: { required: true, type: () => Boolean }, encryptionType: { required: true, type: () => String }, decryptWhen: { required: true, type: () => String }, index: { required: true, type: () => Boolean }, length: { required: true, type: () => Number }, max: { required: true, type: () => Number }, min: { required: true, type: () => Number }, private: { required: true, type: () => Boolean }, mediaTypes: { required: true, type: () => [String] }, mediaMaxSizeKb: { required: true, type: () => Number }, mediaStorageProvider: { required: true, type: () => require("./media-storage-provider-metadata.entity").MediaStorageProviderMetadata }, relationType: { required: true, type: () => String }, relationModelSingularName: { required: true, type: () => String }, relationCreateInverse: { required: true, type: () => Boolean }, relationCascade: { required: true, type: () => String }, relationModelModuleName: { required: true, type: () => String }, relationModelFieldName: { required: true, type: () => String }, selectionDynamicProvider: { required: true, type: () => String }, selectionDynamicProviderCtxt: { required: true, type: () => String }, selectionStaticValues: { required: true, type: () => [String] }, selectionValueType: { required: true, type: () => String, default: "string" }, computedFieldValueProvider: { required: true, type: () => String }, computedFieldValueProviderCtxt: { required: true, type: () => String }, computedFieldValueType: { required: true, type: () => String }, uuid: { required: true, type: () => String }, isSystem: { required: true, type: () => Boolean }, isMarkedForRemoval: { required: true, type: () => Boolean }, columnName: { required: true, type: () => String } };
    }
};
exports.FieldMetadata = FieldMetadata;
__decorate([
    (0, typeorm_1.Column)({ name: "name" }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "display_name" }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "decription", nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'type' }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'orm_type', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "ormType", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => model_metadata_entity_1.ModelMetadata, (model) => model.fields, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'model_id', referencedColumnName: 'id' }),
    __metadata("design:type", model_metadata_entity_1.ModelMetadata)
], FieldMetadata.prototype, "model", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'default_value', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "defaultValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'regex_pattern', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "regexPattern", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'regex_pattern_not_maching_error_msg', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "regexPatternNotMatchingErrorMsg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "required", default: false }),
    __metadata("design:type", Boolean)
], FieldMetadata.prototype, "required", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "unique", default: false }),
    __metadata("design:type", Boolean)
], FieldMetadata.prototype, "unique", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "encrypt", default: false }),
    __metadata("design:type", Boolean)
], FieldMetadata.prototype, "encrypt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'encryption_type', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "encryptionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'decrypt_when', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "decryptWhen", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "index", default: false }),
    __metadata("design:type", Boolean)
], FieldMetadata.prototype, "index", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'length', nullable: true }),
    __metadata("design:type", Number)
], FieldMetadata.prototype, "length", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max', nullable: true }),
    __metadata("design:type", Number)
], FieldMetadata.prototype, "max", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'min', nullable: true }),
    __metadata("design:type", Number)
], FieldMetadata.prototype, "min", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "private", default: false }),
    __metadata("design:type", Boolean)
], FieldMetadata.prototype, "private", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { array: true, name: 'media_types', nullable: true }),
    __metadata("design:type", Array)
], FieldMetadata.prototype, "mediaTypes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'media_max_size_kb', nullable: true }),
    __metadata("design:type", Number)
], FieldMetadata.prototype, "mediaMaxSizeKb", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => media_storage_provider_metadata_entity_1.MediaStorageProviderMetadata, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'media_storage_provider_id' }),
    __metadata("design:type", media_storage_provider_metadata_entity_1.MediaStorageProviderMetadata)
], FieldMetadata.prototype, "mediaStorageProvider", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'relation_type', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "relationType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'relation_model_singular_name', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "relationModelSingularName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "relation_create_inverse", default: false }),
    __metadata("design:type", Boolean)
], FieldMetadata.prototype, "relationCreateInverse", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "relation_cascade", nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "relationCascade", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'relation_model_module_name', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "relationModelModuleName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'relation_model_field_name', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "relationModelFieldName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'selection_dynamic_provider', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "selectionDynamicProvider", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'selection_dynamic_provider_ctxt', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "selectionDynamicProviderCtxt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'selection_static_values', nullable: true, type: 'simple-array' }),
    __metadata("design:type", Array)
], FieldMetadata.prototype, "selectionStaticValues", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'selection_value_type', nullable: true, type: 'text', default: 'string' }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "selectionValueType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'computed_field_value_provider', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "computedFieldValueProvider", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'computed_field_value_provider_ctxt', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "computedFieldValueProviderCtxt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'computed_field_value_type', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "computedFieldValueType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'uuid', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "uuid", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], FieldMetadata.prototype, "isSystem", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], FieldMetadata.prototype, "isMarkedForRemoval", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'column_name', nullable: true }),
    __metadata("design:type", String)
], FieldMetadata.prototype, "columnName", void 0);
exports.FieldMetadata = FieldMetadata = __decorate([
    (0, typeorm_1.Entity)("ss_field_metadata")
], FieldMetadata);
//# sourceMappingURL=field-metadata.entity.js.map