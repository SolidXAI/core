import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CommonEntity } from "src/entities/common.entity";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { LegacyCommonEntityWithExistingId } from "src/entities/legacy-common.entity";
import { LegacyCommonEntityWithGeneratedId } from "src/entities/legacy-common-with-id.entity";
import { Media } from "src/entities/media.entity";
import { MediaStorageProvider } from "src/interfaces";
import { DiskFileService, S3FileService } from "src/services/file";
import { Readable } from "stream";
import { MediaRepository } from "src/repository/media.repository";

@Injectable()
export class FileS3StorageProvider<T> implements MediaStorageProvider<T> {
    private logger = new Logger(FileS3StorageProvider.name);

    constructor(
        private readonly configService: ConfigService,
        readonly diskFileService: DiskFileService,
        readonly s3FileService: S3FileService,
        readonly mediaRepository: MediaRepository,
    ) { }

    storeStreams(streamPairs: [Readable, string][], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        throw new Error("Method not implemented.");
    }

    async retrieve(entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        const isSupportedEntity = entity instanceof CommonEntity
            || entity instanceof LegacyCommonEntityWithExistingId
            || entity instanceof LegacyCommonEntityWithGeneratedId;
        if (!isSupportedEntity) {
            throw new Error("Entity must be an instance of CommonEntity, LegacyCommonEntityWithExistingId or LegacyCommonEntityWithGeneratedId"); // FIXME This needs to be handled through generics. e.g T extends CommonEntity
        }
        // @ts-ignore
        const media = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);

        // TODO: Check if the mediaStorageProvider (s3 in this case) is configured with a public bucket or not.
        // If private bucket then we need to return a "signed-url", the timeout for the signed url can be configured in the media storage provider entity and modified using the CRUD interface.
        // Add the full URL to the media
        for (const m of media) {
            const storageMeta = m.mediaStorageProviderMetadata;
            const region = this.getEffectiveRegion(storageMeta.region);
            if (storageMeta.isPublic === false) {
                // Generate signed URL
                const expiryInSeconds = (storageMeta.signedUrlExpiry ?? 60) * 60;
                m['_full_url'] = await this.s3FileService.getUrl(`${storageMeta?.bucketName}:${m.relativeUri}`, { expiresIn: expiryInSeconds, region });
            } else {
                // Public S3 or local filesystem: use normal URL
                m['_full_url'] = this.getFullFilePath(m);
            }
        }

        return media;
        // media.forEach(m => {
        //     m['_full_url'] = this.getFullFilePath(m);
        // });
        // return media;
    }

    async store(files: Express.Multer.File[], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        const isSupportedEntity = entity instanceof CommonEntity
            || entity instanceof LegacyCommonEntityWithExistingId
            || entity instanceof LegacyCommonEntityWithGeneratedId;
        if (!isSupportedEntity) {
            throw new Error("Entity must be an instance of CommonEntity, LegacyCommonEntityWithExistingId or LegacyCommonEntityWithGeneratedId"); // FIXME This needs to be handled through generics. e.g T extends CommonEntity
        }
        const result: Media[] = [];
        const storageProvider = mediaFieldMetadata.mediaStorageProvider;
        const region = this.getEffectiveRegion(storageProvider.region);

        for (const file of files) {
            const fileName = this.getFileName(file);
            const bucketName = storageProvider.bucketName;

            // Read file from disk and upload to S3
            const fileData = await this.diskFileService.read(file.path);
            await this.s3FileService.write(`${bucketName}:${fileName}`, fileData, { contentType: file.mimetype, region });

            // Delete temp file from disk
            await this.diskFileService.delete(file.path);

            const awsFileUrl = fileName;

            // Create an entry in the media table
            const mediaEntity = await this.mediaRepository.createMedia({
                // @ts-ignore
                entityId: entity.id,
                modelMetadataId: mediaFieldMetadata.model.id,
                relativeUri: awsFileUrl,
                mimeType: file.mimetype,
                fileSize: file.size,
                originalFileName: file.originalname,
                mediaStorageProviderMetadataId: mediaFieldMetadata.mediaStorageProvider.id,
                fieldMetadataId: mediaFieldMetadata.id
            }) as unknown as Media;
            result.push(mediaEntity);
            this.logger.debug(`Stored media with`, mediaEntity);
        };
        return result;
    }

    async delete(entity: T, mediaFieldMetadata: FieldMetadata): Promise<void> {
        const isSupportedEntity = entity instanceof CommonEntity
            || entity instanceof LegacyCommonEntityWithExistingId
            || entity instanceof LegacyCommonEntityWithGeneratedId;
        if (!isSupportedEntity) {
            throw new Error("Entity must be an instance of CommonEntity, LegacyCommonEntityWithExistingId or LegacyCommonEntityWithGeneratedId"); // FIXME This needs to be handled through generics. e.g T extends CommonEntity
        }
        const storageProvider = mediaFieldMetadata.mediaStorageProvider;
        const region = this.getEffectiveRegion(storageProvider.region);

        // @ts-ignore
        const existingMedia = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);
        // @ts-ignore
        this.mediaRepository.deleteByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id);
        for (const media of existingMedia) {
            const bucketName = storageProvider.bucketName;
            await this.s3FileService.delete(`${bucketName}:${media.relativeUri}`, { region });
        }
    }

    async deleteByMediaRecord(media: Media): Promise<void> {
        const storageProvider = media?.mediaStorageProviderMetadata;
        if (!storageProvider) {
            throw new Error(`mediaStorageProviderMetadata is not populated for media id ${media?.id ?? 'unknown'}`);
        }
        if (!storageProvider?.bucketName || !media?.relativeUri) {
            return;
        }
        const region = this.getEffectiveRegion(storageProvider.region);
        await this.s3FileService.delete(`${storageProvider.bucketName}:${media.relativeUri}`, { region });
    }

    /**
     * Get the effective region to use for S3 operations.
     * Uses the provider-specific region if configured, otherwise falls back to env variable.
     */
    private getEffectiveRegion(providerRegion?: string): string | undefined {
        return providerRegion || this.configService.get('S3_AWS_REGION_NAME');
    }

    private getFullFilePath(media: Media): string {
        // Use provider region if available, fallback to env variable
        const region = this.getEffectiveRegion(media.mediaStorageProviderMetadata.region);
        // https://lunarismedia.s3.ap-south-1.amazonaws.com/LUNARIS_CP_REGISTRATION_CREATIVE.jpg
        return `https://${media.mediaStorageProviderMetadata.bucketName}.s3.${region}.amazonaws.com/${media.relativeUri}`;
    }

    private getFileName(file: Express.Multer.File): string {
        return `${file.filename}-${file.originalname}`;
    }
}
