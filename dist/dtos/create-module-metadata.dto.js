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
exports.CreateModuleMetadataDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const create_model_metadata_dto_1 = require("./create-model-metadata.dto");
const is_not_in_enum_decorator_1 = require("../decorators/is-not-in-enum.decorator");
const solid_registry_1 = require("../helpers/solid-registry");
class CreateModuleMetadataDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String, pattern: "/[a-z]+(-[a-z]+)*/" }, displayName: { required: true, type: () => String }, description: { required: true, type: () => String }, menuIconUrl: { required: true, type: () => String }, defaultDataSource: { required: true, type: () => String }, models: { required: true, type: () => [require("./create-model-metadata.dto").CreateModelMetadataDto] }, isSystem: { required: true, type: () => Boolean }, menuSequenceNumber: { required: false, type: () => Number } };
    }
}
exports.CreateModuleMetadataDto = CreateModuleMetadataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Name of your module" }),
    (0, class_validator_1.Matches)(/[a-z]+(-[a-z]+)*/, {
        message: "Only kebab case allowed for module name, also only lower case."
    }),
    (0, is_not_in_enum_decorator_1.IsNotInEnum)(solid_registry_1.RESERVED_SOLID_KEYWORDS),
    __metadata("design:type", String)
], CreateModuleMetadataDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Display name of your module" }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateModuleMetadataDto.prototype, "displayName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Describe your module" }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateModuleMetadataDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Icon file to be used for your module, if file specified then this field can be empty. Else if you have a preuploaded Icon somewhere you can simply specify the Url here. " }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateModuleMetadataDto.prototype, "menuIconUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "The default data source to use with this module" }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateModuleMetadataDto.prototype, "defaultDataSource", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Fields associated with this model" }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => create_model_metadata_dto_1.CreateModelMetadataDto),
    __metadata("design:type", Array)
], CreateModuleMetadataDto.prototype, "models", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'System modules are not included in the code generation, the assumption being that system modules have manually written code.', }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateModuleMetadataDto.prototype, "isSystem", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "The Position of Module in Menu " }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateModuleMetadataDto.prototype, "menuSequenceNumber", void 0);
//# sourceMappingURL=create-module-metadata.dto.js.map