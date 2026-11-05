import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CommonEntity } from "src/entities/common.entity";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { LegacyCommonEntityWithExistingId } from "src/entities/legacy-common.entity-with-existing-id.entity";
import { LegacyCommonEntityWithGeneratedId } from "src/entities/legacy-common-with-generated-id.entity";
import { Media } from "src/entities/media.entity";
import { MediaStorageProvider } from "src/interfaces";
import { MediaStorageProviderMetadata } from "src/entities/media-storage-provider-metadata.entity";
import { MediaStorageProviderType } from "src/dtos/create-media-storage-provider-metadata.dto";
import { DiskFileService, S3FileService } from "src/services/file";
import { resolveDiskMediaPath } from "src/services/file/media-storage-paths";
import { Readable } from "stream";
import { MediaRepository } from "src/repository/media.repository";
import { MediaDownloadUrlService } from "src/services/media-download-url.service";
import {
buildMediaRecordCreateInput,
buildStoredMediaFileName,
getEffectiveS3Region,
} from "src/services/media-storage.utils";

@Injectable()
export class FileS3StorageProvider<T> implements MediaStorageProvider<T> {
    private logger = new Logger(FileS3StorageProvider.name);

    constructor(
        private readonly configService: ConfigService,
        readonly diskFileService: DiskFileService,
        readonly s3FileService: S3FileService,
        readonly mediaRepository: MediaRepository,
        private readonly mediaDownloadUrlService: MediaDownloadUrlService,
    ) { }

    async storeStreams(streamPairs: [Readable, string, { mimeType?: string; originalFileName?: string }?][], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        const entityId = this.getSupportedEntityId(entity);
        const result: Media[] = [];
        const storageProvider = mediaFieldMetadata.mediaStorageProvider;
        const region = getEffectiveS3Region(this.configService, storageProvider.region);

        for (const [stream, fileName, extraMeta] of streamPairs) {
            const bucketName = storageProvider.bucketName;
            const objectPath = `${bucketName}:${fileName}`;

            // Streamed multipart upload; the file is never fully held in memory.
            await this.s3FileService.writeStream(objectPath, stream, { region, contentType: extraMeta?.mimeType });

            const uploaded = await this.s3FileService.stat(objectPath, { region });
            if (!uploaded) {
                throw new Error(`Upload finished but ${objectPath} was not found in S3`);
            }
            const fileSize = uploaded.size;

            const mediaEntity = await this.mediaRepository.createMedia(
                buildMediaRecordCreateInput(entityId, mediaFieldMetadata, storageProvider, {
                    relativeUri: fileName,
                    fileSize,
                    mimeType: extraMeta?.mimeType,
                    originalFileName: extraMeta?.originalFileName,
                })
            ) as unknown as Media;
            result.push(mediaEntity);
            this.logger.debug(`Stored media with`, mediaEntity);
        }
        return result;
    }

    async retrieve(entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        const entityId = this.getSupportedEntityId(entity);
        // @ts-ignore
        const media = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(entityId, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);

        // TODO: Check if the mediaStorageProvider (s3 in this case) is configured with a public bucket or not.
        // If private bucket then we need to return a "signed-url", the timeout for the signed url can be configured in the media storage provider entity and modified using the CRUD interface.
        // Add the full URL to the media
        for (const m of media) {
            m['_full_url'] = await this.mediaDownloadUrlService.buildFullUrl(m);
        }

        return media;
        // media.forEach(m => {
        //     m['_full_url'] = this.getFullFilePath(m);
        // });
        // return media;
    }

    async store(files: Express.Multer.File[], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        const entityId = this.getSupportedEntityId(entity);
        const result: Media[] = [];
        const storageProvider = mediaFieldMetadata.mediaStorageProvider;
        const region = getEffectiveS3Region(this.configService, storageProvider.region);

        for (const file of files) {
            const fileName = buildStoredMediaFileName(file);
            const bucketName = storageProvider.bucketName;

            // Read file from disk and upload to S3
            const fileData = await this.diskFileService.read(file.path);
            await this.s3FileService.write(`${bucketName}:${fileName}`, fileData, { contentType: file.mimetype, region });

            // Delete temp file from disk
            await this.diskFileService.delete(file.path);

            const awsFileUrl = fileName;

            // Create an entry in the media table
            const mediaEntity = await this.mediaRepository.createMedia(
                buildMediaRecordCreateInput(entityId, mediaFieldMetadata, storageProvider, {
                    relativeUri: awsFileUrl,
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

    async delete(entity: T, mediaFieldMetadata: FieldMetadata): Promise<void> {
        const entityId = this.getSupportedEntityId(entity);
        const fieldProvider = mediaFieldMetadata.mediaStorageProvider;

        // @ts-ignore
        const existingMedia = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(entityId, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);
        // @ts-ignore
        await this.mediaRepository.deleteByEntityIdAndFieldIdAndModelMetadataId(entityId, mediaFieldMetadata.id, mediaFieldMetadata.model.id);
        for (const media of existingMedia) {
            // Each row's file lives where its own provider says, which may differ from the field's provider.
            const rowProvider = media.mediaStorageProviderMetadata || fieldProvider;
            await this.deleteStoredFile(media, rowProvider);
        }
    }

    private async deleteStoredFile(media: Media, provider: MediaStorageProviderMetadata): Promise<void> {
        if (provider?.type === MediaStorageProviderType.Filesystem) {
            await this.diskFileService.delete(resolveDiskMediaPath(media.relativeUri, provider.isPublic !== false));
            return;
        }
        const region = getEffectiveS3Region(this.configService, provider.region);
        await this.s3FileService.delete(`${provider.bucketName}:${media.relativeUri}`, { region });
    }

    async deleteByMediaRecord(media: Media): Promise<void> {
        const storageProvider = media?.mediaStorageProviderMetadata;
        if (!storageProvider) {
            throw new Error(`mediaStorageProviderMetadata is not populated for media id ${media?.id ?? 'unknown'}`);
        }
        if (!storageProvider?.bucketName || !media?.relativeUri) {
            return;
        }
        const region = getEffectiveS3Region(this.configService, storageProvider.region);
        await this.s3FileService.delete(`${storageProvider.bucketName}:${media.relativeUri}`, { region });
    }

    private getSupportedEntityId(entity: T): number {
        const isSupportedEntity = entity instanceof CommonEntity
            || entity instanceof LegacyCommonEntityWithExistingId
            || entity instanceof LegacyCommonEntityWithGeneratedId;

        if (!isSupportedEntity) {
            throw new Error("Entity must be an instance of CommonEntity, LegacyCommonEntityWithExistingId or LegacyCommonEntityWithGeneratedId");
        }

        return (entity as any).id;
    }
}
