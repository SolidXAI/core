import { UpdatePermissionMetadataDto } from 'src/dtos/update-permission-metadata.dto';
import { UpdateUserDto } from 'src/dtos/update-user.dto';
import { UpdateMenuItemMetadataDto } from 'src/dtos/update-menu-item-metadata.dto';
export declare class UpdateRoleMetadataDto {
    id: number;
    name: string;
    permissions: UpdatePermissionMetadataDto[];
    permissionsIds: number[];
    permissionsCommand: string;
    users: UpdateUserDto[];
    usersIds: number[];
    usersCommand: string;
    menuItems: UpdateMenuItemMetadataDto[];
    menuItemsIds: number[];
    menuItemsCommand: string;
}
