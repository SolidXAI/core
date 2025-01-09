"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileS3StorageProvider = void 0;
const common_1 = require("@nestjs/common");
const common_entity_1 = require("../../entities/common.entity");
class FileS3StorageProvider {
    constructor(configService, fileService, mediaService) {
        this.configService = configService;
        this.fileService = fileService;
        this.mediaService = mediaService;
        this.logger = new common_1.Logger(FileS3StorageProvider.name);
    }
    async retrieve(entity, mediaFieldMetadata) {
        if (!(entity instanceof common_entity_1.CommonEntity)) {
            throw new Error("Entity must be an instance of CommonEntity");
        }
        const media = await this.mediaService.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);
        media.forEach(m => {
            m['_full_url'] = this.getFullFilePath(m);
        });
        return media;
    }
    async store(files, entity, mediaFieldMetadata) {
        if (!(entity instanceof common_entity_1.CommonEntity)) {
            throw new Error("Entity must be an instance of CommonEntity");
        }
        const result = [];
        files.forEach(async (file) => {
            const fileName = this.getFileName(file);
            let awsFileUrl;
            if (mediaFieldMetadata.mediaStorageProvider.isPublic === true) {
                awsFileUrl = await this.fileService.copyToS3(file.path, file.mimetype, fileName, mediaFieldMetadata.mediaStorageProvider.bucketName);
            }
            else {
                awsFileUrl = await this.fileService.copyToS3WithPublic(file.path, file.mimetype, fileName, mediaFieldMetadata.mediaStorageProvider.bucketName);
            }
            await this.fileService.deleteFile(file.path);
            const mediaEntity = await this.mediaService.create({
                entityId: entity.id,
                modelMetadataId: mediaFieldMetadata.model.id,
                relativeUri: awsFileUrl,
                mediaStorageProviderMetadataId: mediaFieldMetadata.mediaStorageProvider.id,
                fieldMetadataId: mediaFieldMetadata.id
            });
            result.push(mediaEntity);
            this.logger.debug(`Stored media with`, mediaEntity);
        });
        return result;
    }
    async delete(entity, mediaFieldMetadata) {
        if (!(entity instanceof common_entity_1.CommonEntity)) {
            throw new Error("Entity must be an instance of CommonEntity");
        }
        const existingMedia = await this.mediaService.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id);
        this.mediaService.deleteByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id);
        existingMedia.forEach(media => {
            this.fileService.deleteFromS3(media.relativeUri, mediaFieldMetadata.mediaStorageProvider.bucketName);
        });
    }
    getFullFilePath(media) {
        return `https://${media.mediaStorageProviderMetadata.bucketName}.s3.${this.configService.get('S3_AWS_REGION_NAME')}.amazonaws.com/${media.relativeUri}`;
    }
    getFileName(file) {
        return `${file.filename}-${file.originalname}`;
    }
}
exports.FileS3StorageProvider = FileS3StorageProvider;
//# sourceMappingURL=file-s3-storage-provider.js.map