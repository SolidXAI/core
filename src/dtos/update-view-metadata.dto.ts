import { IsInt, IsOptional, IsString, Matches, IsNotEmpty, IsJSON, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateUserViewMetadataDto } from 'src/dtos/update-user-view-metadata.dto';

export class UpdateViewMetadataDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsOptional()
    @Matches(/[a-z]+(-[a-z]+)*/)
    @IsString()
    @ApiProperty()
    name: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    displayName: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    type: string;

    @IsNotEmpty()
    @IsOptional()
    @IsJSON()
    @ApiProperty()
    context: any;

    @IsNotEmpty()
    @IsOptional()
    @IsJSON()
    @ApiProperty()
    layout: any;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    moduleId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    moduleUserKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    modelId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    modelUserKey: string;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateUserViewMetadataDto)
    userViewMetadata: UpdateUserViewMetadataDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    userViewMetadataIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    userViewMetadataCommand: string;
}