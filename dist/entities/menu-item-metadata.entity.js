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
exports.MenuItemMetadata = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const module_metadata_entity_1 = require("./module-metadata.entity");
const action_metadata_entity_1 = require("./action-metadata.entity");
const role_metadata_entity_1 = require("./role-metadata.entity");
let MenuItemMetadata = class MenuItemMetadata extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, displayName: { required: true, type: () => String }, module: { required: true, type: () => require("./module-metadata.entity").ModuleMetadata }, parentMenuItem: { required: true, type: () => require("./menu-item-metadata.entity").MenuItemMetadata }, action: { required: true, type: () => require("./action-metadata.entity").ActionMetadata }, roles: { required: true, type: () => [require("./role-metadata.entity").RoleMetadata] }, sequenceNumber: { required: true, type: () => Number } };
    }
};
exports.MenuItemMetadata = MenuItemMetadata;
__decorate([
    (0, typeorm_1.Column)({ name: "name", type: "varchar", unique: true }),
    __metadata("design:type", String)
], MenuItemMetadata.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "display_name", type: "varchar" }),
    __metadata("design:type", String)
], MenuItemMetadata.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.JoinColumn)({ name: 'module_id', referencedColumnName: 'id' }),
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => module_metadata_entity_1.ModuleMetadata, { onDelete: "CASCADE" }),
    __metadata("design:type", module_metadata_entity_1.ModuleMetadata)
], MenuItemMetadata.prototype, "module", void 0);
__decorate([
    (0, typeorm_1.JoinColumn)({ name: 'parent_menu_item_id', referencedColumnName: 'id' }),
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => MenuItemMetadata, { onDelete: "CASCADE" }),
    __metadata("design:type", MenuItemMetadata)
], MenuItemMetadata.prototype, "parentMenuItem", void 0);
__decorate([
    (0, typeorm_1.JoinColumn)({ name: 'action_id', referencedColumnName: 'id' }),
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => action_metadata_entity_1.ActionMetadata, { onDelete: "CASCADE" }),
    __metadata("design:type", action_metadata_entity_1.ActionMetadata)
], MenuItemMetadata.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => role_metadata_entity_1.RoleMetadata, roleMetadata => roleMetadata.menuItems, { cascade: true }),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], MenuItemMetadata.prototype, "roles", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "sequence_number", type: "int", nullable: true }),
    __metadata("design:type", Number)
], MenuItemMetadata.prototype, "sequenceNumber", void 0);
exports.MenuItemMetadata = MenuItemMetadata = __decorate([
    (0, typeorm_1.Entity)("ss_menu_item_metadata")
], MenuItemMetadata);
//# sourceMappingURL=menu-item-metadata.entity.js.map