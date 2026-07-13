import { IsInt,IsOptional, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class UpdateMediaDto {
    @IsOptional()
    @IsInt()
    id: number;

@IsNotEmpty()
@IsOptional()
@IsInt()
@ApiProperty()
entityId: number;

@IsOptional()
@IsString()
@ApiProperty()
relativeUri: string;

@IsOptional()
@IsInt()
@ApiProperty()
fileSize: number;

@IsOptional()
@IsString()
@ApiProperty()
mimeType: string;

@IsOptional()
@IsString()
@ApiProperty()
originalFileName: string;

@IsOptional()
@IsInt()
@ApiProperty()
modelMetadataId: number;

@IsString()
@IsOptional()
@ApiProperty()
modelMetadataUserKey: string;

@IsOptional()
@IsInt()
@ApiProperty()
mediaStorageProviderMetadataId: number;

@IsString()
@IsOptional()
@ApiProperty()
mediaStorageProviderMetadataUserKey: string;

@IsOptional()
@IsInt()
@ApiProperty()
fieldMetadataId: number;

@IsString()
@IsOptional()
@ApiProperty()
fieldMetadataUserKey: string;
}