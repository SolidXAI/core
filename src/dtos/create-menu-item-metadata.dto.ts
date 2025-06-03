import { IsNumber, IsString } from 'class-validator';
import { Matches } from 'class-validator';
import { IsNotEmpty, IsInt, IsOptional, ValidateNested, IsArray } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import arrayTransformer from '../transformers/array-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UpdateRoleMetadataDto } from 'src/dtos/update-role-metadata.dto';

export class CreateMenuItemMetadataDto {
    @IsNotEmpty()
    @Matches(/[a-z]+(-[a-z]+)*/)
    @IsString()
    @ApiProperty()
    name: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    displayName: string;
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
    parentMenuItemId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    parentMenuItemUserKey: string;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    actionId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    actionUserKey: string;
    @Transform(arrayTransformer)
    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateRoleMetadataDto)
    roles: UpdateRoleMetadataDto[];
    @IsOptional()
    @IsArray()
    @ApiProperty()
    rolesIds: number[];
    @IsString()
    @IsOptional()
    @ApiProperty()
    rolesCommand: string;
    @IsOptional()
    @IsNumber()
    @ApiProperty()
    sequenceNumber: number;

    @IsOptional()
    @IsString()
    @ApiProperty()
    iconName: string;

}