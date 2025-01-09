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
    
    @IsNotEmpty()
    @IsInt()
    mediaStorageProviderMetadataId: number;

    @IsNotEmpty()
    @IsInt()
    fieldMetadataId: number; 
}