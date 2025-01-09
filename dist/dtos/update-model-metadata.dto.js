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
exports.UpdateModelMetaDataDto = void 0;
const openapi = require("@nestjs/swagger");
const mapped_types_1 = require("@nestjs/mapped-types");
const create_model_metadata_dto_1 = require("./create-model-metadata.dto");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const update_field_metadata_dto_1 = require("./update-field-metadata.dto");
const class_transformer_1 = require("class-transformer");
class UpdateModelMetaDataDto extends (0, mapped_types_1.PartialType)(create_model_metadata_dto_1.CreateModelMetadataDto) {
    static _OPENAPI_METADATA_FACTORY() {
        return { id: { required: false, type: () => Number }, fields: { required: false, type: () => [require("./update-field-metadata.dto").UpdateFieldMetaDataDto] } };
    }
}
exports.UpdateModelMetaDataDto = UpdateModelMetaDataDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateModelMetaDataDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Fields associated with this model" }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => update_field_metadata_dto_1.UpdateFieldMetaDataDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], UpdateModelMetaDataDto.prototype, "fields", void 0);
//# sourceMappingURL=update-model-metadata.dto.js.map