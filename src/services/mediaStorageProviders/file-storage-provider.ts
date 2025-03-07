import { Inject, Logger } from "@nestjs/common";
import { ConfigService, ConfigType } from "@nestjs/config";
import { MediaStorageProvider } from "src/interfaces";
import { FileService } from "src/services/file.service";
import { MediaService } from "../media.service";
import { Media } from "src/entities/media.entity";
import { CommonEntity } from "src/entities/common.entity";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import appBuilderConfig from "src/config/app-builder.config";

export class FileStorageProvider<T> implements MediaStorageProvider<T> {
    private logger = new Logger(FileStorageProvider.name);

    constructor(
        // @Inject(appBuilderConfig.KEY)
        // private readonly appBuilderConfiguration: ConfigType<typeof appBuilderConfig>,
        private readonly configService: ConfigService, 
        readonly fileService: FileService,
        readonly mediaService: MediaService
    ) { }
    async retrieve(entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        if (!(entity instanceof CommonEntity)) {
            throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        }
        const media = await this.mediaService.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);
        // Add the full URL to the media
        media.forEach(m => {
            m['_full_url'] = this.getFullFilePath(m.relativeUri);
        });
        return media;
    }

    async store(files: Express.Multer.File[], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        if (!(entity instanceof CommonEntity)) {
            throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        }
        const result: Media[] = [];
        files.forEach(async (file) => {
            // Store the file in the configured file storage directory
            const fileStoragePath = this.getFullFilePath(this.getFileName(file));
            this.fileService.copyFile(file.path, fileStoragePath);
            this.fileService.deleteFile(file.path);

            // Create an entry in the media table
            const mediaEntity = await this.mediaService.create({
                entityId: entity.id,
                modelMetadataId: mediaFieldMetadata.model.id,
                relativeUri: this.getFileName(file),
                mediaStorageProviderMetadataId: mediaFieldMetadata.mediaStorageProvider.id,
                fieldMetadataId: mediaFieldMetadata.id
            }) as unknown as Media;
            result.push(mediaEntity);
            this.logger.debug(`Stored media with`, mediaEntity);
        });
        return result;
    }

    async delete(entity: T, mediaFieldMetadata: FieldMetadata): Promise<void> {
        if (!(entity instanceof CommonEntity)) {
            throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        }
        const existingMedia = await this.mediaService.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id);
        this.mediaService.deleteByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id);
        existingMedia.forEach(media => {
            this.fileService.deleteFile(this.getFullFilePath(media.relativeUri));
        });
    }

    private getFullFilePath(fileName: string): string {
        return `${process.env.BASE_URL}/${this.configService.get('app-builder.fileStorageDir')}/${fileName}`;
    }

    private getFileName(file: Express.Multer.File): string {
        return `${file.filename}-${file.originalname}`;
    }
}