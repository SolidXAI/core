import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, isBoolean } from "class-validator";
export enum MediaStorageProviderType {
    Filesystem = 'filesystem',
    AwsS3 = 'aws-s3',
    AzureBlobStorage = 'azure-blob-storage'
}
export class CreateMediaStorageProviderMetadataDto {
    // name
    @IsNotEmpty()
    @IsString()
    readonly name : string;

    // type filesystem|aws-s3|azure-blob-storage
    @IsNotEmpty()
    @IsEnum(MediaStorageProviderType)
    readonly type : MediaStorageProviderType;

    // region
    @IsString()
    @IsOptional()
    readonly region : string;

    // bucketName
    @IsString()
    @IsOptional()
    readonly bucketName : string;

    // isPublic
    @IsOptional()
    @IsBoolean()
    readonly isPublic : boolean;

    // localPath
    @IsString()
    @IsOptional()
    readonly localPath : string;
}