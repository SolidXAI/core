import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class ResolveS3UrlDto {
    @IsNotEmpty()
    s3Key: string;

    @IsOptional()
    bucketName?: string;

    @IsOptional()
    mediaStorageProviderUserKey?: string;

    @IsNotEmpty()
    isPrivate: string;
}






