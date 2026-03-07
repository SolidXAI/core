import { IsOptional, IsString } from 'class-validator';
import { Matches } from 'class-validator';
import { IsNotEmpty, IsJSON, IsInt, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateUserViewMetadataDto } from 'src/dtos/update-user-view-metadata.dto';

export class CreateViewMetadataDto {
    @IsNotEmpty()
    @Matches(/[a-z]+(-[a-z]+)*/, { message: "Only kebab case allowed for module name, also only lower case." })
    @IsString()
    @ApiProperty()
    name: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    displayName: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    type: string;

    @IsNotEmpty()
    @IsJSON()
    @ApiProperty()
    context: any = "{}";

    @IsNotEmpty()
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