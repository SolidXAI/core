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
exports.CreatePermissionMetadataDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_validator_2 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const update_role_metadata_dto_1 = require("./update-role-metadata.dto");
class CreatePermissionMetadataDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, roles: { required: true, type: () => [require("./update-role-metadata.dto").UpdateRoleMetadataDto] }, rolesIds: { required: true, type: () => [Number] }, rolesCommand: { required: true, type: () => String } };
    }
}
exports.CreatePermissionMetadataDto = CreatePermissionMetadataDto;
__decorate([
    (0, class_validator_2.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePermissionMetadataDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_2.IsArray)(),
    (0, class_validator_2.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => update_role_metadata_dto_1.UpdateRoleMetadataDto),
    (0, class_validator_2.IsOptional)(),
    __metadata("design:type", Array)
], CreatePermissionMetadataDto.prototype, "roles", void 0);
__decorate([
    (0, class_validator_2.IsOptional)(),
    (0, class_validator_2.IsArray)(),
    __metadata("design:type", Array)
], CreatePermissionMetadataDto.prototype, "rolesIds", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_2.IsOptional)(),
    __metadata("design:type", String)
], CreatePermissionMetadataDto.prototype, "rolesCommand", void 0);
//# sourceMappingURL=create-permission-metadata.dto.js.map