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
exports.Media = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const media_storage_provider_metadata_entity_1 = require("./media-storage-provider-metadata.entity");
const model_metadata_entity_1 = require("./model-metadata.entity");
const field_metadata_entity_1 = require("./field-metadata.entity");
let Media = class Media extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { entityId: { required: true, type: () => Number }, modelMetadata: { required: true, type: () => require("./model-metadata.entity").ModelMetadata }, relativeUri: { required: true, type: () => String }, mediaStorageProviderMetadata: { required: true, type: () => require("./media-storage-provider-metadata.entity").MediaStorageProviderMetadata }, fieldMetadata: { required: true, type: () => require("./field-metadata.entity").FieldMetadata } };
    }
};
exports.Media = Media;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "entity_id" }),
    __metadata("design:type", Number)
], Media.prototype, "entityId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => model_metadata_entity_1.ModelMetadata),
    (0, typeorm_1.JoinColumn)({ name: "model_metadata_id" }),
    __metadata("design:type", model_metadata_entity_1.ModelMetadata)
], Media.prototype, "modelMetadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "relative_uri" }),
    __metadata("design:type", String)
], Media.prototype, "relativeUri", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => media_storage_provider_metadata_entity_1.MediaStorageProviderMetadata),
    (0, typeorm_1.JoinColumn)({ name: "media_storage_provider_metadata_id" }),
    __metadata("design:type", media_storage_provider_metadata_entity_1.MediaStorageProviderMetadata)
], Media.prototype, "mediaStorageProviderMetadata", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => field_metadata_entity_1.FieldMetadata),
    (0, typeorm_1.JoinColumn)({ name: "field_metadata_id" }),
    __metadata("design:type", field_metadata_entity_1.FieldMetadata)
], Media.prototype, "fieldMetadata", void 0);
exports.Media = Media = __decorate([
    (0, typeorm_1.Entity)("ss_media")
], Media);
//# sourceMappingURL=media.entity.js.map