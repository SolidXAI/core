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
exports.PermissionMetadata = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const role_metadata_entity_1 = require("./role-metadata.entity");
let PermissionMetadata = class PermissionMetadata extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, roles: { required: true, type: () => [require("./role-metadata.entity").RoleMetadata] } };
    }
};
exports.PermissionMetadata = PermissionMetadata;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "name", type: "varchar", unique: true }),
    __metadata("design:type", String)
], PermissionMetadata.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => role_metadata_entity_1.RoleMetadata, roleMetadata => roleMetadata.permissions, { cascade: ['insert', 'update'] }),
    __metadata("design:type", Array)
], PermissionMetadata.prototype, "roles", void 0);
exports.PermissionMetadata = PermissionMetadata = __decorate([
    (0, typeorm_1.Entity)("ss_permission_metadata")
], PermissionMetadata);
//# sourceMappingURL=permission-metadata.entity.js.map