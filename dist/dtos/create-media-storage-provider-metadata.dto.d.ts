export declare enum MediaStorageProviderType {
    Filesystem = "filesystem",
    AwsS3 = "aws-s3",
    AzureBlobStorage = "azure-blob-storage"
}
export declare class CreateMediaStorageProviderMetadataDto {
    readonly name: string;
    readonly type: MediaStorageProviderType;
    readonly region: string;
    readonly bucketName: string;
    readonly isPublic: boolean;
    readonly localPath: string;
}
