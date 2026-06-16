import { IsString } from 'class-validator';
import { IsNotEmpty, ValidateNested, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateRoleMetadataDto } from 'src/dtos/update-role-metadata.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePermissionMetadataDto {
    @IsNotEmpty()
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