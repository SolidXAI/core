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
var MediaStorageProviderMetadataSeederService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaStorageProviderMetadataSeederService = void 0;
const common_1 = require("@nestjs/common");
const media_storage_provider_metadata_service_1 = require("./media-storage-provider-metadata.service");
let MediaStorageProviderMetadataSeederService = MediaStorageProviderMetadataSeederService_1 = class MediaStorageProviderMetadataSeederService {
    constructor(mediaStorageProviderMetadataService) {
        this.mediaStorageProviderMetadataService = mediaStorageProviderMetadataService;
        this.logger = new common_1.Logger(MediaStorageProviderMetadataSeederService_1.name);
    }
    async seed() {
        const existingDefaultFs = await this.mediaStorageProviderMetadataService.findOneByUserKey('default-filesystem');
        if (!existingDefaultFs) {
            await this.mediaStorageProviderMetadataService.create({
                name: 'default-filesystem',
                type: 'filesystem'
            });
        }
        const existingDefaultAws = await this.mediaStorageProviderMetadataService.findOneByUserKey('default-aws-s3');
        if (!existingDefaultAws) {
            await this.mediaStorageProviderMetadataService.create({
                name: 'default-aws-s3',
                type: 'aws-s3'
            });
        }
    }
};
exports.MediaStorageProviderMetadataSeederService = MediaStorageProviderMetadataSeederService;
exports.MediaStorageProviderMetadataSeederService = MediaStorageProviderMetadataSeederService = MediaStorageProviderMetadataSeederService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [media_storage_provider_metadata_service_1.MediaStorageProviderMetadataService])
], MediaStorageProviderMetadataSeederService);
//# sourceMappingURL=media-storage-provider-metadata-seeder.service.js.map