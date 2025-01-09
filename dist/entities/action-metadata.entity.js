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
exports.ActionMetadata = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const module_metadata_entity_1 = require("./module-metadata.entity");
const model_metadata_entity_1 = require("./model-metadata.entity");
const view_metadata_entity_1 = require("./view-metadata.entity");
let ActionMetadata = class ActionMetadata extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, displayName: { required: true, type: () => String }, type: { required: true, type: () => String }, domain: { required: true, type: () => Object }, context: { required: true, type: () => Object }, customComponent: { required: true, type: () => String }, customIsModal: { required: true, type: () => Boolean }, serverEndpoint: { required: true, type: () => String }, module: { required: true, type: () => require("./module-metadata.entity").ModuleMetadata }, model: { required: true, type: () => require("./model-metadata.entity").ModelMetadata }, view: { required: true, type: () => require("./view-metadata.entity").ViewMetadata } };
    }
};
exports.ActionMetadata = ActionMetadata;
__decorate([
    (0, typeorm_1.Column)({ name: "name", type: "varchar", unique: true }),
    __metadata("design:type", String)
], ActionMetadata.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "display_name", type: "varchar" }),
    __metadata("design:type", String)
], ActionMetadata.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "type", type: "varchar" }),
    __metadata("design:type", String)
], ActionMetadata.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "domain", type: "text", nullable: true }),
    __metadata("design:type", Object)
], ActionMetadata.prototype, "domain", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "context", type: "text", nullable: true }),
    __metadata("design:type", Object)
], ActionMetadata.prototype, "context", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "custom_component", type: "varchar", nullable: true }),
    __metadata("design:type", String)
], ActionMetadata.prototype, "customComponent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "custom_is_modal", type: "boolean", nullable: true }),
    __metadata("design:type", Boolean)
], ActionMetadata.prototype, "customIsModal", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "server_endpoint", type: "varchar", nullable: true }),
    __metadata("design:type", String)
], ActionMetadata.prototype, "serverEndpoint", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => module_metadata_entity_1.ModuleMetadata, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: 'module_id', referencedColumnName: 'id' }),
    __metadata("design:type", module_metadata_entity_1.ModuleMetadata)
], ActionMetadata.prototype, "module", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => model_metadata_entity_1.ModelMetadata, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: 'model_id', referencedColumnName: 'id' }),
    __metadata("design:type", model_metadata_entity_1.ModelMetadata)
], ActionMetadata.prototype, "model", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => view_metadata_entity_1.ViewMetadata, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: 'view_id', referencedColumnName: 'id' }),
    __metadata("design:type", view_metadata_entity_1.ViewMetadata)
], ActionMetadata.prototype, "view", void 0);
exports.ActionMetadata = ActionMetadata = __decorate([
    (0, typeorm_1.Entity)("ss_action_metadata")
], ActionMetadata);
//# sourceMappingURL=action-metadata.entity.js.map