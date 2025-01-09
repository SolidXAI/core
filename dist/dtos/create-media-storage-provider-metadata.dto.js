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
exports.CreateMediaStorageProviderMetadataDto = exports.MediaStorageProviderType = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
var MediaStorageProviderType;
(function (MediaStorageProviderType) {
    MediaStorageProviderType["Filesystem"] = "filesystem";
    MediaStorageProviderType["AwsS3"] = "aws-s3";
    MediaStorageProviderType["AzureBlobStorage"] = "azure-blob-storage";
})(MediaStorageProviderType || (exports.MediaStorageProviderType = MediaStorageProviderType = {}));
class CreateMediaStorageProviderMetadataDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, type: { required: true, enum: require("./create-media-storage-provider-metadata.dto").MediaStorageProviderType }, region: { required: true, type: () => String }, bucketName: { required: true, type: () => String }, isPublic: { required: true, type: () => Boolean }, localPath: { required: true, type: () => String } };
    }
}
exports.CreateMediaStorageProviderMetadataDto = CreateMediaStorageProviderMetadataDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMediaStorageProviderMetadataDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsEnum)(MediaStorageProviderType),
    __metadata("design:type", String)
], CreateMediaStorageProviderMetadataDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateMediaStorageProviderMetadataDto.prototype, "region", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateMediaStorageProviderMetadataDto.prototype, "bucketName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateMediaStorageProviderMetadataDto.prototype, "isPublic", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateMediaStorageProviderMetadataDto.prototype, "localPath", void 0);
//# sourceMappingURL=create-media-storage-provider-metadata.dto.js.map