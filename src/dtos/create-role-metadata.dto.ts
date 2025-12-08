import { IsString } from 'class-validator';
import { IsNotEmpty, ValidateNested, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdatePermissionMetadataDto } from 'src/dtos/update-permission-metadata.dto';
import { UpdateUserDto } from 'src/dtos/update-user.dto';
import { UpdateMenuItemMetadataDto } from 'src/dtos/update-menu-item-metadata.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleMetadataDto {
    @IsNotEmpty()
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
}
export const ADMIN_ROLE_NAME = 'Admin';
export const INTERNAL_ROLE_NAME = 'Internal User';
export const PUBLIC_ROLE_NAME = 'Public';
export const INTERNAL_ROLE_PERMISSIONS = [
    // User permissions
    'UserController.findMany', //Why do we need this?
    'UserController.checkIfPermissionExists',
    'UserController.findOne',
    // Menu permissions
    'MenuItemMetadataController.findMany',
    'MenuItemMetadataController.findUserMenus',
    'MenuItemMetadataController.findOne',
    // View metadata permissions
    'ViewMetadataController.getLayout',
    'ViewMetadataController.findMany',
    'ViewMetadataController.findOne',
    // User View metadata permissions
    'UserViewMetadataController.upsert',
    'UserViewMetadataController.findMany',
    'UserViewMetadataController.findOne',
    // IAM permissions
    'AuthenticationController.changePassword',
    'AuthenticationController.logout',
    'AuthenticationController.me',
    // Field Metadata permissions
    'FieldMetadataController.getSelectionDynamicValues',
    'FieldMetadataController.getSelectionDynamicValue',
    'FieldMetadataController.findFieldDefaultMetaData',
    // Saved Filters permissions
    'SavedFiltersController.delete',
    'SavedFiltersController.deleteMany',
    'SavedFiltersController.findOne',
    'SavedFiltersController.findMany',
    'SavedFiltersController.recover',
    'SavedFiltersController.recoverMany',
    'SavedFiltersController.partialUpdate',
    'SavedFiltersController.update',
    'SavedFiltersController.insertMany',
    'SavedFiltersController.create',
    // Logout permissions
    'AuthenticationController.logout',
    // Other permissions can be added here as required.
    // Chatter permissions
    'ChatterMessageController.create',
    'ChatterMessageController.getChatterMessages',
    // 'ChatterMessageController.postMessage', // Does not seem to be used from ui
    // Import
    'ImportTransactionController.getImportTemplate',
    'ImportTransactionController.getImportInstructions',
    'ImportTransactionController.getImportMappingInfo',
    'ImportTransactionController.startImportSync',
    'ImportTransactionController.startImportAsync',
    'ImportTransactionController.exportFailedImportedImports',
    // Export permissions
    'ExportTemplateController.startExportSync',
    'ExportTemplateController.startExportAsync',
    // List of values
    'ListOfValuesController.findMany',
    'ListOfValuesController.findOne',
    // Media // [Not required], since media is always populated as part of a model
]