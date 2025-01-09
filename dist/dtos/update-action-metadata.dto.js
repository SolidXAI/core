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
exports.UpdateActionMetadataDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class UpdateActionMetadataDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { id: { required: true, type: () => Number }, name: { required: true, type: () => String, pattern: "/[a-z]+(-[a-z]+)*/" }, displayName: { required: true, type: () => String }, type: { required: true, type: () => String }, domain: { required: true, type: () => Object }, context: { required: true, type: () => Object }, customComponent: { required: true, type: () => String }, customIsModal: { required: true, type: () => Boolean }, serverEndpoint: { required: true, type: () => String }, moduleId: { required: true, type: () => Number }, moduleUserKey: { required: true, type: () => String }, modelId: { required: true, type: () => Number }, modelUserKey: { required: true, type: () => String }, viewId: { required: true, type: () => Number }, viewUserKey: { required: true, type: () => String } };
    }
}
exports.UpdateActionMetadataDto = UpdateActionMetadataDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateActionMetadataDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Matches)(/[a-z]+(-[a-z]+)*/),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateActionMetadataDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateActionMetadataDto.prototype, "displayName", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateActionMetadataDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsJSON)(),
    __metadata("design:type", Object)
], UpdateActionMetadataDto.prototype, "domain", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsJSON)(),
    __metadata("design:type", Object)
], UpdateActionMetadataDto.prototype, "context", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateActionMetadataDto.prototype, "customComponent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateActionMetadataDto.prototype, "customIsModal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateActionMetadataDto.prototype, "serverEndpoint", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], UpdateActionMetadataDto.prototype, "moduleId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateActionMetadataDto.prototype, "moduleUserKey", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], UpdateActionMetadataDto.prototype, "modelId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateActionMetadataDto.prototype, "modelUserKey", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], UpdateActionMetadataDto.prototype, "viewId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateActionMetadataDto.prototype, "viewUserKey", void 0);
//# sourceMappingURL=update-action-metadata.dto.js.map