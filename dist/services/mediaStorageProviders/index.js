"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMediaStorageProvider = getMediaStorageProvider;
const create_media_storage_provider_metadata_dto_1 = require("../../dtos/create-media-storage-provider-metadata.dto");
const file_storage_provider_1 = require("./file-storage-provider");
const file_s3_storage_provider_1 = require("./file-s3-storage-provider");
function getMediaStorageProvider(configService, fileService, mediaService, type) {
    switch (type) {
        case create_media_storage_provider_metadata_dto_1.MediaStorageProviderType.Filesystem:
            return new file_storage_provider_1.FileStorageProvider(configService, fileService, mediaService);
        case create_media_storage_provider_metadata_dto_1.MediaStorageProviderType.AwsS3:
            return new file_s3_storage_provider_1.FileS3StorageProvider(configService, fileService, mediaService);
        default:
            throw new Error(`Unknown media storage provider type ${type}`);
    }
}
//# sourceMappingURL=index.js.map