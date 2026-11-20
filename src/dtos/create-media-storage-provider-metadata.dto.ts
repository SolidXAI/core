import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, isBoolean } from "class-validator";
export enum MediaStorageProviderType {
    Filesystem = 'filesystem',
    AwsS3 = 'aws-s3',
    AzureBlobStorage = 'azure-blob-storage'
}
export class CreateMediaStorageProviderMetadataDto {
    // name
    @IsNotEmpty()
    @IsString()
    readonly name: string;

    // type filesystem|aws-s3|azure-blob-storage
    @IsNotEmpty()
    @IsEnum(MediaStorageProviderType)
    readonly type: MediaStorageProviderType;

    // region
    @IsString()
    @IsOptional()
    readonly region: string;

    // bucketName
    @IsString()
    @IsOptional()
    readonly bucketName: string;

    // isPublic
    // Multipart form posts send "false" as text. Implicit conversion would turn that into true
    // (any non-empty text is truthy), so read the raw submitted value instead.
    @IsOptional()
    @Transform(({ obj, key }) => {
        const raw = obj[key];
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        if (raw === '') return undefined;
        return raw;
    })
    @IsBoolean()
    readonly isPublic: boolean;

    // localPath
    @IsString()
    @IsOptional()
    readonly localPath: string;

    @IsOptional()
    @IsNumber()
    readonly signedUrlExpiry: number; // stored in minutes
}