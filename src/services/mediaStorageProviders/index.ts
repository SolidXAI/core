import { ModuleRef } from "@nestjs/core";
import { FileS3StorageProvider } from "./file-s3-storage-provider";
import { FileStorageProvider } from "./file-storage-provider";
import { MediaStorageProviderType } from "../../dtos/create-media-storage-provider-metadata.dto";

export async function getMediaStorageProvider<T>(
    moduleRef: ModuleRef,
    type: MediaStorageProviderType): Promise<any> {
    switch (type) {
        case MediaStorageProviderType.Filesystem:
            return await moduleRef.get(FileStorageProvider, { strict: false });
        case MediaStorageProviderType.AwsS3:
            return await moduleRef.get(FileS3StorageProvider, { strict: false });
        default:
            throw new Error(`Unknown media storage provider type ${type}`);
    }
}