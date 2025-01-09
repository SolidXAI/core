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
exports.CreateRoleMetadataDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_validator_2 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const update_permission_metadata_dto_1 = require("./update-permission-metadata.dto");
const update_user_dto_1 = require("./update-user.dto");
const update_menu_item_metadata_dto_1 = require("./update-menu-item-metadata.dto");
class CreateRoleMetadataDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, permissions: { required: true, type: () => [require("./update-permission-metadata.dto").UpdatePermissionMetadataDto] }, permissionsIds: { required: true, type: () => [Number] }, permissionsCommand: { required: true, type: () => String }, users: { required: true, type: () => [require("./update-user.dto").UpdateUserDto] }, usersIds: { required: true, type: () => [Number] }, usersCommand: { required: true, type: () => String }, menuItems: { required: true, type: () => [require("./update-menu-item-metadata.dto").UpdateMenuItemMetadataDto] }, menuItemsIds: { required: true, type: () => [Number] }, menuItemsCommand: { required: true, type: () => String } };
    }
}
exports.CreateRoleMetadataDto = CreateRoleMetadataDto;
__decorate([
    (0, class_validator_2.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRoleMetadataDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_2.IsOptional)(),
    (0, class_validator_2.IsArray)(),
    (0, class_validator_2.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => update_permission_metadata_dto_1.UpdatePermissionMetadataDto),
    __metadata("design:type", Array)
], CreateRoleMetadataDto.prototype, "permissions", void 0);
__decorate([
    (0, class_validator_2.IsOptional)(),
    (0, class_validator_2.IsArray)(),
    __metadata("design:type", Array)
], CreateRoleMetadataDto.prototype, "permissionsIds", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_2.IsOptional)(),
    __metadata("design:type", String)
], CreateRoleMetadataDto.prototype, "permissionsCommand", void 0);
__decorate([
    (0, class_validator_2.IsOptional)(),
    (0, class_validator_2.IsArray)(),
    (0, class_validator_2.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => update_user_dto_1.UpdateUserDto),
    __metadata("design:type", Array)
], CreateRoleMetadataDto.prototype, "users", void 0);
__decorate([
    (0, class_validator_2.IsOptional)(),
    (0, class_validator_2.IsArray)(),
    __metadata("design:type", Array)
], CreateRoleMetadataDto.prototype, "usersIds", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_2.IsOptional)(),
    __metadata("design:type", String)
], CreateRoleMetadataDto.prototype, "usersCommand", void 0);
__decorate([
    (0, class_validator_2.IsOptional)(),
    (0, class_validator_2.IsArray)(),
    (0, class_validator_2.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => update_menu_item_metadata_dto_1.UpdateMenuItemMetadataDto),
    __metadata("design:type", Array)
], CreateRoleMetadataDto.prototype, "menuItems", void 0);
__decorate([
    (0, class_validator_2.IsOptional)(),
    (0, class_validator_2.IsArray)(),
    __metadata("design:type", Array)
], CreateRoleMetadataDto.prototype, "menuItemsIds", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_2.IsOptional)(),
    __metadata("design:type", String)
], CreateRoleMetadataDto.prototype, "menuItemsCommand", void 0);
//# sourceMappingURL=create-role-metadata.dto.js.map