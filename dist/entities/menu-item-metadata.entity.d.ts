import { CommonEntity } from "src/entities/common.entity";
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { ActionMetadata } from 'src/entities/action-metadata.entity';
import { RoleMetadata } from "./role-metadata.entity";
export declare class MenuItemMetadata extends CommonEntity {
    name: string;
    displayName: string;
    module: ModuleMetadata;
    parentMenuItem: MenuItemMetadata;
    action: ActionMetadata;
    roles: RoleMetadata[];
    sequenceNumber: number;
}
