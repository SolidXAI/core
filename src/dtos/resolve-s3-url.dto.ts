import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class ResolveS3UrlDto {
    @IsNotEmpty()
    modelName: string;

    @IsNotEmpty()
    fieldName: string;

    @IsNotEmpty()
    s3KeyFieldName: string;

    @IsNotEmpty()
    fieldValue: string;

    @IsNotEmpty()
    fileType: string;
    
    @IsNotEmpty()
    bucketName: string;

    @IsNotEmpty()
    isPrivate: string;
}









