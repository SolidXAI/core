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
exports.CreateViewMetadataDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_validator_2 = require("class-validator");
const class_validator_3 = require("class-validator");
class CreateViewMetadataDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String, pattern: "/[a-z]+(-[a-z]+)*/" }, displayName: { required: true, type: () => String }, type: { required: true, type: () => String }, context: { required: true, type: () => Object }, layout: { required: true, type: () => Object }, moduleId: { required: true, type: () => Number }, moduleUserKey: { required: true, type: () => String }, modelId: { required: true, type: () => Number }, modelUserKey: { required: true, type: () => String } };
    }
}
exports.CreateViewMetadataDto = CreateViewMetadataDto;
__decorate([
    (0, class_validator_3.IsNotEmpty)(),
    (0, class_validator_2.Matches)(/[a-z]+(-[a-z]+)*/, { message: "Only kebab case allowed for module name, also only lower case." }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateViewMetadataDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_3.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateViewMetadataDto.prototype, "displayName", void 0);
__decorate([
    (0, class_validator_3.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateViewMetadataDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_3.IsNotEmpty)(),
    (0, class_validator_3.IsJSON)(),
    __metadata("design:type", Object)
], CreateViewMetadataDto.prototype, "context", void 0);
__decorate([
    (0, class_validator_3.IsNotEmpty)(),
    (0, class_validator_3.IsJSON)(),
    __metadata("design:type", Object)
], CreateViewMetadataDto.prototype, "layout", void 0);
__decorate([
    (0, class_validator_3.IsNotEmpty)(),
    __metadata("design:type", Number)
], CreateViewMetadataDto.prototype, "moduleId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateViewMetadataDto.prototype, "moduleUserKey", void 0);
__decorate([
    (0, class_validator_3.IsNotEmpty)(),
    __metadata("design:type", Number)
], CreateViewMetadataDto.prototype, "modelId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateViewMetadataDto.prototype, "modelUserKey", void 0);
//# sourceMappingURL=create-view-metadata.dto.js.map