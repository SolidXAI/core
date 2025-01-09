"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStorageProvider = void 0;
const common_1 = require("@nestjs/common");
const common_entity_1 = require("../../entities/common.entity");
class FileStorageProvider {
    constructor(configService, fileService, mediaService) {
        this.configService = configService;
        this.fileService = fileService;
        this.mediaService = mediaService;
        this.logger = new common_1.Logger(FileStorageProvider.name);
    }
    async retrieve(entity, mediaFieldMetadata) {
        if (!(entity instanceof common_entity_1.CommonEntity)) {
            throw new Error("Entity must be an instance of CommonEntity");
        }
        const media = await this.mediaService.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);
        media.forEach(m => {
            m['_full_url'] = this.getFullFilePath(m.relativeUri);
        });
        return media;
    }
    async store(files, entity, mediaFieldMetadata) {
        if (!(entity instanceof common_entity_1.CommonEntity)) {
            throw new Error("Entity must be an instance of CommonEntity");
        }
        const result = [];
        files.forEach(async (file) => {
            const fileStoragePath = this.getFullFilePath(this.getFileName(file));
            this.fileService.copyFile(file.path, fileStoragePath);
            this.fileService.deleteFile(file.path);
            const mediaEntity = await this.mediaService.create({
                entityId: entity.id,
                modelMetadataId: mediaFieldMetadata.model.id,
                relativeUri: this.getFileName(file),
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
            this.fileService.deleteFile(this.getFullFilePath(media.relativeUri));
        });
    }
    getFullFilePath(fileName) {
        return `${this.configService.get('app-builder.fileStorageDir')}/${fileName}`;
    }
    getFileName(file) {
        return `${file.filename}-${file.originalname}`;
    }
}
exports.FileStorageProvider = FileStorageProvider;
//# sourceMappingURL=file-storage-provider.js.map