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
exports.UpdateMenuItemMetadataDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const update_role_metadata_dto_1 = require("./update-role-metadata.dto");
const array_transformer_1 = require("../transformers/array-transformer");
class UpdateMenuItemMetadataDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { id: { required: true, type: () => Number }, name: { required: true, type: () => String, pattern: "/[a-z]+(-[a-z]+)*/" }, displayName: { required: true, type: () => String }, moduleId: { required: true, type: () => Number }, moduleUserKey: { required: true, type: () => String }, parentMenuItemId: { required: true, type: () => Number }, parentMenuItemUserKey: { required: true, type: () => String }, actionId: { required: true, type: () => Number }, actionUserKey: { required: true, type: () => String }, roles: { required: true, type: () => [require("./update-role-metadata.dto").UpdateRoleMetadataDto] }, rolesIds: { required: true, type: () => [Number] }, rolesCommand: { required: true, type: () => String }, sequenceNumber: { required: true, type: () => Number } };
    }
}
exports.UpdateMenuItemMetadataDto = UpdateMenuItemMetadataDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateMenuItemMetadataDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Matches)(/[a-z]+(-[a-z]+)*/),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMenuItemMetadataDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMenuItemMetadataDto.prototype, "displayName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateMenuItemMetadataDto.prototype, "moduleId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateMenuItemMetadataDto.prototype, "moduleUserKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateMenuItemMetadataDto.prototype, "parentMenuItemId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateMenuItemMetadataDto.prototype, "parentMenuItemUserKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateMenuItemMetadataDto.prototype, "actionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateMenuItemMetadataDto.prototype, "actionUserKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_transformer_1.Transform)(array_transformer_1.default),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => update_role_metadata_dto_1.UpdateRoleMetadataDto),
    __metadata("design:type", Array)
], UpdateMenuItemMetadataDto.prototype, "roles", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpdateMenuItemMetadataDto.prototype, "rolesIds", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateMenuItemMetadataDto.prototype, "rolesCommand", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateMenuItemMetadataDto.prototype, "sequenceNumber", void 0);
//# sourceMappingURL=update-menu-item-metadata.dto.js.map