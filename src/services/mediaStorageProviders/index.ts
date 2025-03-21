import { ModuleRef } from "@nestjs/core";
import { MediaStorageProviderType } from "src/dtos/create-media-storage-provider-metadata.dto";
import { FileS3StorageProvider } from "./file-s3-storage-provider";
import { FileStorageProvider } from "./file-storage-provider";

export async function getMediaStorageProvider<T>(
    moduleRef: ModuleRef,
    type: MediaStorageProviderType): Promise<any> {
    switch(type) {
        case MediaStorageProviderType.Filesystem:
            return await moduleRef.resolve(FileStorageProvider);
        case MediaStorageProviderType.AwsS3:
            return await moduleRef.resolve(FileS3StorageProvider);
        default:
            throw new Error(`Unknown media storage provider type ${type}`);
    }
}