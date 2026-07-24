import { Injectable, Logger } from "@nestjs/common";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { Media } from "src/entities/media.entity";
import { MediaStorageProviderMetadata } from "src/entities/media-storage-provider-metadata.entity";
import { MediaStorageProvider } from "src/interfaces";
import { MediaRepository } from "src/repository/media.repository";
import { DiskFileService } from "src/services/file";
import { Readable } from "stream";
import * as fs from "fs";
import { SettingService } from "../setting.service";
import { MediaDownloadUrlService } from "src/services/media-download-url.service";
import {buildDiskMediaPath,buildMediaRecordCreateInput,buildStoredMediaFileName,resolveMediaIsPublic,} from "src/services/media-storage.utils";

@Injectable()
export class FileStorageProvider<T> implements MediaStorageProvider<T> {
    private logger = new Logger(FileStorageProvider.name);

    constructor(
        readonly fileService: DiskFileService,
        readonly mediaRepository: MediaRepository,
        private readonly settingService: SettingService,
        private readonly mediaDownloadUrlService: MediaDownloadUrlService,

    ) { }

    async retrieve(entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        // if (!(entity instanceof CommonEntity)) {
        //     throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        // }
        //@ts-ignore
        const media = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(this.getEntityId(entity), mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);
        // Add the full URL to the media
        // media.forEach(m => {
        // });
        for (const m of media) {
            const storageProvider = this.resolveMediaStorageProvider(m, mediaFieldMetadata);
            const isPublic = resolveMediaIsPublic(storageProvider);
            m['_full_url'] = isPublic === false
                ? await this.mediaDownloadUrlService.getPrivateUrl(m.id, m.relativeUri, storageProvider)
                : await this.fileService.getUrl(buildDiskMediaPath(m.relativeUri, this.settingService, storageProvider));
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
            const fileName = buildStoredMediaFileName(file);
            const fileStoragePath = buildDiskMediaPath(fileName, this.settingService, storageProvider);
            await this.fileService.copy(file.path, fileStoragePath);
            await this.fileService.delete(file.path);

            // Create an entry in the media table
            const mediaEntity = await this.mediaRepository.createMedia(
                buildMediaRecordCreateInput(this.getEntityId(entity), mediaFieldMetadata, storageProvider, {
                    relativeUri: fileName,
                    mimeType: file.mimetype,
                    fileSize: file.size,
                    originalFileName: file.originalname,
                })
            ) as unknown as Media;
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
            const fullPath = buildDiskMediaPath(fileName, this.settingService, storageProvider);
            await this.fileService.writeStream(fullPath, stream);
            const { size: fileSize } = await fs.promises.stat(fullPath);
            const mediaEntity = await this.mediaRepository.createMedia(
                buildMediaRecordCreateInput(this.getEntityId(entity), mediaFieldMetadata, storageProvider, {
                    relativeUri: fileName,
                    fileSize,
                })
            ) as unknown as Media;
            result.push(mediaEntity);
            this.logger.debug(`Stored media with`, mediaEntity);
        };
        return result;
    }

    async delete(entity: T, mediaFieldMetadata: FieldMetadata): Promise<void> {
        // if (!(entity instanceof CommonEntity)) {
        //     throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        // }
        const entityId = this.getEntityId(entity);
        const existingMedia = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(entityId, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);
        await this.mediaRepository.deleteByEntityIdAndFieldIdAndModelMetadataId(entityId, mediaFieldMetadata.id, mediaFieldMetadata.model.id);

        for (const media of existingMedia) {
            const storageProvider = this.resolveMediaStorageProvider(media, mediaFieldMetadata);
            await this.fileService.delete(buildDiskMediaPath(media.relativeUri, this.settingService, storageProvider));
        }
        // existingMedia.forEach(media => {
        // });
    }

    async deleteByMediaRecord(media: Media): Promise<void> {
        if (!media?.relativeUri) {
            return;
        }
        await this.fileService.delete(buildDiskMediaPath(media.relativeUri, this.settingService, media.mediaStorageProviderMetadata));
    }

    private resolveMediaStorageProvider(media: Media, mediaFieldMetadata?: FieldMetadata): MediaStorageProviderMetadata | undefined {
        return media.mediaStorageProviderMetadata || mediaFieldMetadata?.mediaStorageProvider;
    }

    private getEntityId(entity: T): number {
        return (entity as any).id;
    }
}
