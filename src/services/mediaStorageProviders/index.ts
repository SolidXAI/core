import { MediaStorageProviderType } from "src/dtos/create-media-storage-provider-metadata.dto";
import { FileStorageProvider } from "./file-storage-provider";
import { MediaStorageProvider } from "src/interfaces";
import { ConfigService } from "@nestjs/config";
import { FileService } from "src/services/file.service";
import { MediaService } from "../media.service";
import { CommonEntity } from "src/entities/common.entity";
import { FileS3StorageProvider } from "./file-s3-storage-provider";

export function getMediaStorageProvider<T>(
    configService: ConfigService, 
    fileService: FileService, 
    mediaService: MediaService, 
    type: MediaStorageProviderType): MediaStorageProvider<T> {
    switch(type) {
        case MediaStorageProviderType.Filesystem:
            return new FileStorageProvider<T>(configService, fileService, mediaService);
        case MediaStorageProviderType.AwsS3:
            return new FileS3StorageProvider<T>(configService, fileService, mediaService);
        default:
            throw new Error(`Unknown media storage provider type ${type}`);
    }
}