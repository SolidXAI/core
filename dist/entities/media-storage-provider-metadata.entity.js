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
exports.MediaStorageProviderMetadata = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
let MediaStorageProviderMetadata = class MediaStorageProviderMetadata extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, type: { required: true, type: () => String }, region: { required: true, type: () => String }, bucketName: { required: true, type: () => String }, isPublic: { required: true, type: () => Boolean }, localPath: { required: true, type: () => String } };
    }
};
exports.MediaStorageProviderMetadata = MediaStorageProviderMetadata;
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], MediaStorageProviderMetadata.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MediaStorageProviderMetadata.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MediaStorageProviderMetadata.prototype, "region", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "bucket_name", nullable: true }),
    __metadata("design:type", String)
], MediaStorageProviderMetadata.prototype, "bucketName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_public", nullable: true }),
    __metadata("design:type", Boolean)
], MediaStorageProviderMetadata.prototype, "isPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "local_path", nullable: true }),
    __metadata("design:type", String)
], MediaStorageProviderMetadata.prototype, "localPath", void 0);
exports.MediaStorageProviderMetadata = MediaStorageProviderMetadata = __decorate([
    (0, typeorm_1.Entity)("ss_media_storage_provider_metadata")
], MediaStorageProviderMetadata);
//# sourceMappingURL=media-storage-provider-metadata.entity.js.map