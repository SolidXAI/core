import { CommonEntity } from "src/entities/common.entity";
import { PermissionMetadata } from 'src/entities/permission-metadata.entity';
import { User } from 'src/entities/user.entity';
import { MenuItemMetadata } from 'src/entities/menu-item-metadata.entity';
export declare class RoleMetadata extends CommonEntity {
    name: string;
    permissions: PermissionMetadata[];
    users: User[];
    menuItems: MenuItemMetadata[];
}
