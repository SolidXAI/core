import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class ResolveS3UrlDto {
    @IsNotEmpty()
    modelName: string;

    @IsNotEmpty()
    fieldName: string;


    @IsNotEmpty()
    fileType?: string;

    @IsNotEmpty()
    s3Key?: string;

    @IsOptional()
    bucketName?: string;

    @IsOptional()
    mediaStorageProviderUserKey?: string;

    @IsNotEmpty()
    isPrivate?: string;
}






