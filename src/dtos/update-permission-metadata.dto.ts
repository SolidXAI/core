import { IsInt, IsOptional, IsString, IsNotEmpty, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateRoleMetadataDto } from 'src/dtos/update-role-metadata.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePermissionMetadataDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    name: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateRoleMetadataDto)
    @IsOptional()
    roles: UpdateRoleMetadataDto[];

    @IsOptional()
    @IsArray()
    rolesIds: number[];

    @IsString()
    @IsOptional()
    rolesCommand: string;
}