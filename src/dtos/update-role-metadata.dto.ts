import { IsInt,IsOptional, IsString, IsNotEmpty, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdatePermissionMetadataDto } from 'src/dtos/update-permission-metadata.dto';
import { UpdateUserDto } from 'src/dtos/update-user.dto';
import { UpdateMenuItemMetadataDto } from 'src/dtos/update-menu-item-metadata.dto';
export class UpdateRoleMetadataDto {
    @IsOptional()
    @IsInt()
    id: number;

@IsOptional()    
@IsNotEmpty()
@IsString()
name: string;

@IsOptional()
@IsArray()
@ValidateNested({ each : true })
@Type(() => UpdatePermissionMetadataDto)
permissions: UpdatePermissionMetadataDto[];

@IsOptional()
@IsArray()
permissionsIds: number[];

@IsString()
@IsOptional()
permissionsCommand: string;

@IsOptional()
@IsArray()
@ValidateNested({ each : true })
@Type(() => UpdateUserDto)
users: UpdateUserDto[];

@IsOptional()
@IsArray()
usersIds: number[];

@IsString()
@IsOptional()
usersCommand: string;

@IsOptional()
@IsArray()
@ValidateNested({ each : true })
@Type(() => UpdateMenuItemMetadataDto)
menuItems: UpdateMenuItemMetadataDto[];

@IsOptional()
@IsArray()
menuItemsIds: number[];

@IsString()
@IsOptional()
menuItemsCommand: string;
}