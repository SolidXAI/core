import { IsInt, IsOptional, IsString, IsNotEmpty, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdatePermissionMetadataDto } from 'src/dtos/update-permission-metadata.dto';
import { UpdateUserDto } from 'src/dtos/update-user.dto';
import { UpdateMenuItemMetadataDto } from 'src/dtos/update-menu-item-metadata.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleMetadataDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    name: string;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdatePermissionMetadataDto)
    permissions: UpdatePermissionMetadataDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    permissionsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    permissionsCommand: string;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateUserDto)
    users: UpdateUserDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    usersIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    usersCommand: string;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateMenuItemMetadataDto)
    menuItems: UpdateMenuItemMetadataDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    menuItemsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    menuItemsCommand: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    moduleId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    moduleUserKey: string;
}