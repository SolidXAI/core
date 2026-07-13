import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CommonEntity } from "src/entities/common.entity";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { Media } from "src/entities/media.entity";
import { MediaStorageProviderMetadata } from "src/entities/media-storage-provider-metadata.entity";
import { MediaStorageProvider } from "src/interfaces";
import { MediaRepository } from "src/repository/media.repository";
import { DiskFileService } from "src/services/file";
import { Readable } from "stream";
import * as path from "path";
import * as fs from "fs";
import { SettingService } from "../setting.service";
import { DEFAULT_MEDIA_FILE_STORAGE_DIR} from "src/services/settings/default-settings-provider.service";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

const DEFAULT_PRIVATE_MEDIA_STORAGE_DIR = "media-private-files-storage";

@Injectable()
export class FileStorageProvider<T> implements MediaStorageProvider<T> {
    private logger = new Logger(FileStorageProvider.name);

    constructor(
        // @Inject(appBuilderConfig.KEY)
        // private readonly appBuilderConfiguration: ConfigType<typeof appBuilderConfig>,
        private readonly configService: ConfigService,
        readonly fileService: DiskFileService,
        readonly mediaRepository: MediaRepository,
        private readonly settingService: SettingService

    ) { }

    async retrieve(entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        // if (!(entity instanceof CommonEntity)) {
        //     throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        // }
        //@ts-ignore
        const media = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);
        // Add the full URL to the media
        // media.forEach(m => {
        // });
        for (const m of media) {
            const storageProvider = this.resolveMediaStorageProvider(m, mediaFieldMetadata);
            const isPublic = this.resolveStoredIsPublic(m.isPublic, storageProvider);
            m.isPublic = isPublic;
            m['_full_url'] = isPublic === false
                ? this.getDownloadPath(m.id)
                : await this.fileService.getUrl(this.getFullFilePath(m.relativeUri, storageProvider));
        }


        return media;
    }

    async store(files: Express.Multer.File[], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        // if (!(entity instanceof CommonEntity)) {
        //     throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        // }
        const result: Media[] = [];
        const storageProvider = mediaFieldMetadata.mediaStorageProvider;
        for (const file of files) {
            // Store the file in the configured file storage directory
            const fileStoragePath = this.getFullFilePath(this.getFileName(file), storageProvider);
            await this.fileService.copy(file.path, fileStoragePath);
            await this.fileService.delete(file.path);

            // Create an entry in the media table
            const mediaEntity = await this.mediaRepository.createMedia({
                //@ts-ignore
                entityId: entity.id,
                modelMetadataId: mediaFieldMetadata.model.id,
                relativeUri: this.getFileName(file),
                mimeType: file.mimetype,
                fileSize: file.size,
                originalFileName: file.originalname,
                mediaStorageProviderMetadataId: storageProvider.id,
                fieldMetadataId: mediaFieldMetadata.id
            }) as unknown as Media;
            mediaEntity.isPublic = this.resolveStoredIsPublic(mediaEntity.isPublic, storageProvider);
            result.push(mediaEntity);
            this.logger.debug(`Stored media with`, mediaEntity);
        };
        return result;
    }

    async storeStreams(streamPairs: [Readable, string][], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        // if (!(entity instanceof CommonEntity)) {
        //     throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        // }
        const result: Media[] = [];
        const storageProvider = mediaFieldMetadata.mediaStorageProvider;
        for (const pair of streamPairs) {
            const stream = pair[0];
            const fileName = pair[1];
            const fullPath = this.getFullFilePath(fileName, storageProvider);
            await this.fileService.writeStream(fullPath, stream);
            const { size: fileSize } = await fs.promises.stat(fullPath);
            const mediaEntity = await this.mediaRepository.createMedia({
                //@ts-ignore
                entityId: entity.id,
                modelMetadataId: mediaFieldMetadata.model.id,
                relativeUri: fileName,
                fileSize,
                mediaStorageProviderMetadataId: storageProvider.id,
                fieldMetadataId: mediaFieldMetadata.id
            }) as unknown as Media;
            mediaEntity.isPublic = this.resolveStoredIsPublic(mediaEntity.isPublic, storageProvider);
            result.push(mediaEntity);
            this.logger.debug(`Stored media with`, mediaEntity);
        };
        return result;
    }

    async delete(entity: T, mediaFieldMetadata: FieldMetadata): Promise<void> {
        // if (!(entity instanceof CommonEntity)) {
        //     throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        // }
        //@ts-ignore
        const existingMedia = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);
        //@ts-ignore
        await this.mediaRepository.deleteByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id);

        for (const media of existingMedia) {
            const storageProvider = this.resolveMediaStorageProvider(media, mediaFieldMetadata);
            await this.fileService.delete(this.getFullFilePath(media.relativeUri, storageProvider));
        }
        // existingMedia.forEach(media => {
        // });
    }

    async deleteByMediaRecord(media: Media): Promise<void> {
        if (!media?.relativeUri) {
            return;
        }
        await this.fileService.delete(this.getFullFilePath(media.relativeUri, media.mediaStorageProviderMetadata));
    }

    private getFullFilePath(fileName: string, storageProvider?: MediaStorageProviderMetadata): string {
        const publicBase = this.settingService.getConfigValue<SolidCoreSetting>("fileStorageDir") || DEFAULT_MEDIA_FILE_STORAGE_DIR;
        const privateBase = DEFAULT_PRIVATE_MEDIA_STORAGE_DIR;
        const providerBase = storageProvider?.localPath || (storageProvider?.isPublic === false ? privateBase : publicBase);
        if (path.isAbsolute(fileName) || fileName.startsWith(`${publicBase}/`) || fileName.startsWith(`${privateBase}/`) || (!!storageProvider?.localPath && fileName.startsWith(`${storageProvider.localPath}/`))) {
            return fileName;
        }
        return `${providerBase}/${fileName}`;
    }

    private getDownloadPath(id: number): string {
        return `/media/${id}/download`;
    }

    private getFileName(file: Express.Multer.File): string {
        return `${file.filename}-${file.originalname}`;
    }

    private resolveMediaStorageProvider(media: Media, mediaFieldMetadata?: FieldMetadata): MediaStorageProviderMetadata | undefined {
        return media.mediaStorageProviderMetadata || mediaFieldMetadata?.mediaStorageProvider;
    }

    private resolveIsPublic(storageProvider?: MediaStorageProviderMetadata): boolean | undefined {
        if (!storageProvider) {
            return undefined;
        }
        return storageProvider.isPublic !== false;
    }

    private resolveStoredIsPublic(currentValue: boolean | undefined, storageProvider?: MediaStorageProviderMetadata): boolean | undefined {
        if (typeof currentValue === 'boolean') {
            return currentValue;
        }
        return this.resolveIsPublic(storageProvider);
    }
}
