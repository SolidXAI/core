import { CommonEntity } from "src/entities/common.entity";
import { RoleMetadata } from 'src/entities/role-metadata.entity';
export declare class PermissionMetadata extends CommonEntity {
    name: string;
    roles: RoleMetadata[];
}
