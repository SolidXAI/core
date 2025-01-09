import { UpdateRoleMetadataDto } from './update-role-metadata.dto';
export declare class CreateMenuItemMetadataDto {
    name: string;
    displayName: string;
    moduleId: number;
    moduleUserKey: string;
    parentMenuItemId: number;
    parentMenuItemUserKey: string;
    actionId: number;
    actionUserKey: string;
    roles: UpdateRoleMetadataDto[];
    rolesIds: number[];
    rolesCommand: string;
    sequenceNumber: number;
}
