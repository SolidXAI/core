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
exports.ViewMetadata = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const module_metadata_entity_1 = require("./module-metadata.entity");
const model_metadata_entity_1 = require("./model-metadata.entity");
let ViewMetadata = class ViewMetadata extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, displayName: { required: true, type: () => String }, type: { required: true, type: () => String }, context: { required: true, type: () => Object }, layout: { required: true, type: () => Object }, module: { required: true, type: () => require("./module-metadata.entity").ModuleMetadata }, model: { required: true, type: () => require("./model-metadata.entity").ModelMetadata } };
    }
};
exports.ViewMetadata = ViewMetadata;
__decorate([
    (0, typeorm_1.Column)({ name: "name", type: "varchar", unique: true }),
    __metadata("design:type", String)
], ViewMetadata.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "display_name", type: "varchar" }),
    __metadata("design:type", String)
], ViewMetadata.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "type", type: "varchar" }),
    __metadata("design:type", String)
], ViewMetadata.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "context", type: "text" }),
    __metadata("design:type", Object)
], ViewMetadata.prototype, "context", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "layout", type: "text" }),
    __metadata("design:type", Object)
], ViewMetadata.prototype, "layout", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => module_metadata_entity_1.ModuleMetadata, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: 'module_id', referencedColumnName: 'id' }),
    __metadata("design:type", module_metadata_entity_1.ModuleMetadata)
], ViewMetadata.prototype, "module", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => model_metadata_entity_1.ModelMetadata, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: 'model_id', referencedColumnName: 'id' }),
    __metadata("design:type", model_metadata_entity_1.ModelMetadata)
], ViewMetadata.prototype, "model", void 0);
exports.ViewMetadata = ViewMetadata = __decorate([
    (0, typeorm_1.Entity)("ss_view_metadata")
], ViewMetadata);
//# sourceMappingURL=view-metadata.entity.js.map