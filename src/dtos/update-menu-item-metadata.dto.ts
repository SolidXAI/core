import { IsInt, IsOptional, IsString, Matches, IsNotEmpty, ValidateNested, IsArray, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UpdateRoleMetadataDto } from './update-role-metadata.dto';
import arrayTransformer from '../transformers/array-transformer';
export class UpdateMenuItemMetadataDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @Matches(/[a-z]+(-[a-z]+)*/)
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    displayName: string;

    @IsOptional()
    @IsInt()
    moduleId: number;

    @IsString()
    @IsOptional()
    moduleUserKey: string;

    @IsOptional()
    @IsInt()
    parentMenuItemId: number;

    @IsString()
    @IsOptional()
    parentMenuItemUserKey: string;

    @IsOptional()
    @IsInt()
    actionId: number;

    @IsString()
    @IsOptional()
    actionUserKey: string;

    @IsOptional()
    @IsArray()
    @Transform(arrayTransformer)
    @ValidateNested({ each: true })
    @Type(() => UpdateRoleMetadataDto)
    roles: UpdateRoleMetadataDto[];

    @IsOptional()
    @IsArray()
    rolesIds: number[];

    @IsString()
    @IsOptional()
    rolesCommand: string;

    @IsOptional()
    @IsNumber()
    sequenceNumber: number;

}