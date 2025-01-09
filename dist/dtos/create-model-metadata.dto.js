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
exports.CreateModelMetadataDto = exports.DatasourceType = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const create_field_metadata_dto_1 = require("./create-field-metadata.dto");
const is_not_in_enum_decorator_1 = require("../decorators/is-not-in-enum.decorator");
const solid_registry_1 = require("../helpers/solid-registry");
var DatasourceType;
(function (DatasourceType) {
    DatasourceType["mysql"] = "mysql";
    DatasourceType["postgres"] = "postgres";
    DatasourceType["mssql"] = "mssql";
    DatasourceType["oracle"] = "oracle";
    DatasourceType["mariadb"] = "mariadb";
})(DatasourceType || (exports.DatasourceType = DatasourceType = {}));
class CreateModelMetadataDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { singularName: { required: true, type: () => String, pattern: "/[a-z]+(-[a-z]+)*/" }, tableName: { required: false, type: () => String, pattern: "/[a-z]+(_[a-z]+)*/" }, pluralName: { required: true, type: () => String, pattern: "/[a-z]+(-[a-z]+)*/" }, displayName: { required: true, type: () => String }, description: { required: true, type: () => String }, dataSource: { required: true, type: () => String }, dataSourceType: { required: true, type: () => String }, enableSoftDelete: { required: true, type: () => Boolean }, enableAuditTracking: { required: true, type: () => Boolean }, internationalisation: { required: true, type: () => Boolean }, moduleId: { required: true, type: () => Number }, moduleUserKey: { required: false, type: () => String }, userKeyFieldId: { required: true, type: () => Number }, userKeyFieldUserKey: { required: false, type: () => String }, fields: { required: true, type: () => [require("./create-field-metadata.dto").CreateFieldMetadataDto] }, isExportable: { required: true, type: () => Boolean }, isSystem: { required: true, type: () => Boolean } };
    }
}
exports.CreateModelMetadataDto = CreateModelMetadataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Display name of your model" }),
    (0, class_validator_1.Matches)(/[a-z]+(-[a-z]+)*/, {
        message: "Model name should follow snake case conventions only with all lower case."
    }),
    (0, is_not_in_enum_decorator_1.IsNotInEnum)(solid_registry_1.RESERVED_SOLID_KEYWORDS),
    __metadata("design:type", String)
], CreateModelMetadataDto.prototype, "singularName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Name of your module" }),
    (0, class_validator_1.Matches)(/[a-z]+(_[a-z]+)*/, {
        message: "Only snake case allowed for module table name, also only lower case."
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateModelMetadataDto.prototype, "tableName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Display name of your model" }),
    (0, class_validator_1.Matches)(/[a-z]+(-[a-z]+)*/, {
        message: "Model name should follow snake case conventions only with all lower case."
    }),
    __metadata("design:type", String)
], CreateModelMetadataDto.prototype, "pluralName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Display name of your model" }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateModelMetadataDto.prototype, "displayName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Describe your model" }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateModelMetadataDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "The data source to use with this model" }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateModelMetadataDto.prototype, "dataSource", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "You can have models linked to MongoDB or to an RDBMS" }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateModelMetadataDto.prototype, "dataSourceType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Enable Soft Delete" }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateModelMetadataDto.prototype, "enableSoftDelete", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Enable Soft Delete" }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateModelMetadataDto.prototype, "enableAuditTracking", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Enable Soft Delete" }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateModelMetadataDto.prototype, "internationalisation", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Related module id" }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateModelMetadataDto.prototype, "moduleId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateModelMetadataDto.prototype, "moduleUserKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Related user key field id" }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateModelMetadataDto.prototype, "userKeyFieldId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateModelMetadataDto.prototype, "userKeyFieldUserKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Fields associated with this model" }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => create_field_metadata_dto_1.CreateFieldMetadataDto),
    __metadata("design:type", Array)
], CreateModelMetadataDto.prototype, "fields", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Is Exportable" }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateModelMetadataDto.prototype, "isExportable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'System models are not included in the code generation, the assumption being that system models have manually written code.', }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateModelMetadataDto.prototype, "isSystem", void 0);
//# sourceMappingURL=create-model-metadata.dto.js.map