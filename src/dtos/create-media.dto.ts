import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, isBoolean } from "class-validator";
export class CreateMediaDto {

    @IsNotEmpty()
    @IsInt()
    entityId: number;

    @IsNotEmpty()
    @IsInt()
    modelMetadataId: number;

    @IsNotEmpty()
    @IsString()
    relativeUri: string;

    @IsOptional()
    @IsString()
    mimeType: string;

    @IsOptional()
    @IsInt()
    fileSize: number;

    @IsOptional()
    @IsString()
    originalFileName: string;

    @IsNotEmpty()
    @IsInt()
    mediaStorageProviderMetadataId: number;

    @IsNotEmpty()
    @IsInt()
    fieldMetadataId: number;
}