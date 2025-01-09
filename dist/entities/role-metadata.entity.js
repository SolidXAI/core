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
exports.RoleMetadata = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const permission_metadata_entity_1 = require("./permission-metadata.entity");
const user_entity_1 = require("./user.entity");
const menu_item_metadata_entity_1 = require("./menu-item-metadata.entity");
let RoleMetadata = class RoleMetadata extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, permissions: { required: true, type: () => [require("./permission-metadata.entity").PermissionMetadata] }, users: { required: true, type: () => [require("./user.entity").User] }, menuItems: { required: true, type: () => [require("./menu-item-metadata.entity").MenuItemMetadata] } };
    }
};
exports.RoleMetadata = RoleMetadata;
__decorate([
    (0, typeorm_1.Column)({ name: "name", type: "varchar", unique: true }),
    __metadata("design:type", String)
], RoleMetadata.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => permission_metadata_entity_1.PermissionMetadata, permissionMetadata => permissionMetadata.roles, { cascade: true }),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], RoleMetadata.prototype, "permissions", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => user_entity_1.User, user => user.roles, { cascade: ['insert', 'update'] }),
    __metadata("design:type", Array)
], RoleMetadata.prototype, "users", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => menu_item_metadata_entity_1.MenuItemMetadata, menuItemMetadata => menuItemMetadata.roles, { cascade: ['insert', 'update'] }),
    __metadata("design:type", Array)
], RoleMetadata.prototype, "menuItems", void 0);
exports.RoleMetadata = RoleMetadata = __decorate([
    (0, typeorm_1.Entity)("ss_role_metadata")
], RoleMetadata);
//# sourceMappingURL=role-metadata.entity.js.map