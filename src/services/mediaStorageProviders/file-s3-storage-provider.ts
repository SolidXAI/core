import {Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService, ConfigType } from "@nestjs/config";
import { CommonEntity } from "src/entities/common.entity";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { Media } from "src/entities/media.entity";
import { MediaStorageProvider } from "src/interfaces";
import { FileService } from "src/services/file.service";
import { Readable } from "stream";
import { MediaRepository } from "src/repository/media.repository";
import { getSignedUrl } from "../crud.service";
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import commonConfig from "src/config/common.config";

@Injectable()
export class FileS3StorageProvider<T> implements MediaStorageProvider<T> {
    private logger = new Logger(FileS3StorageProvider.name);
    private readonly s3Client: S3Client;

    constructor(
        // @Inject(appBuilderConfig.KEY)
        // private readonly appBuilderConfiguration: ConfigType<typeof appBuilderConfig>,
        private readonly configService: ConfigService,
        readonly fileService: FileService,
        readonly mediaRepository: MediaRepository,
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
    ) { 
        this.s3Client = new S3Client({
            region: this.commonConfiguration.awsS3Credentials.S3_AWS_REGION_NAME,
            credentials: {
              accessKeyId: this.commonConfiguration.awsS3Credentials.S3_AWS_ACCESS_KEY,
              secretAccessKey: this.commonConfiguration.awsS3Credentials.S3_AWS_SECRET_KEY,
            },
          });
    }

    storeStreams(streamPairs: [Readable, string][], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        throw new Error("Method not implemented.");
    }

    async retrieve(entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        if (!(entity instanceof CommonEntity)) {
            throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        }
        const media = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);

        // TODO: Check if the mediaStorageProvider (s3 in this case) is configured with a public bucket or not. 
        // If private bucket then we need to return a "signed-url", the timeout for the signed url can be configured in the media storage provider entity and modified using the CRUD interface.
        // Add the full URL to the media
        for (const m of media) {
            const storageMeta = m.mediaStorageProviderMetadata;
            if (storageMeta.type === 'aws-s3' && storageMeta.isPublic === false) {
                // Generate signed URL
                const expiryInSeconds = (storageMeta.signedUrlExpiry ?? 5) * 60; // default 5 min
                m['_full_url'] = await getSignedUrl(this.s3Client, m.relativeUri, expiryInSeconds, storageMeta?.bucketName);
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
        if (!(entity instanceof CommonEntity)) {
            throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        }
        const result: Media[] = [];
        files.forEach(async (file) => {
            const fileName = this.getFileName(file);
            // Store the file in the configured S3 Bucket
            let awsFileUrl;
            if (mediaFieldMetadata.mediaStorageProvider.isPublic === true) {
                awsFileUrl = await this.fileService.copyToS3WithPublic(file.path, file.mimetype, fileName, mediaFieldMetadata.mediaStorageProvider.bucketName,);
            } else {
                awsFileUrl = await this.fileService.copyToS3(file.path, file.mimetype, fileName, mediaFieldMetadata.mediaStorageProvider.bucketName,);
            }
            await this.fileService.deleteFile(file.path);

            // Create an entry in the media table
            const mediaEntity = await this.mediaRepository.createMedia({
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
        });
        return result;
    }

    async delete(entity: T, mediaFieldMetadata: FieldMetadata): Promise<void> {
        if (!(entity instanceof CommonEntity)) {
            throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        }
        const existingMedia = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);
        this.mediaRepository.deleteByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id);
        existingMedia.forEach(media => {
            this.fileService.deleteFromS3(media.relativeUri, mediaFieldMetadata.mediaStorageProvider.bucketName); //TODO
        });
    }

    //TODO: Move this to a app builder config
    private getFullFilePath(media: Media): string {
        // https://lunarismedia.s3.ap-south-1.amazonaws.com/LUNARIS_CP_REGISTRATION_CREATIVE.jpg
        return `https://${media.mediaStorageProviderMetadata.bucketName}.s3.${this.configService.get('S3_AWS_REGION_NAME')}.amazonaws.com/${media.relativeUri}`;
    }

    private getFileName(file: Express.Multer.File): string {
        return `${file.filename}-${file.originalname}`;
    }
}