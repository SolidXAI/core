import { UpdateRoleMetadataDto } from 'src/dtos/update-role-metadata.dto';
export declare class UpdatePermissionMetadataDto {
    id: number;
    name: string;
    roles: UpdateRoleMetadataDto[];
    rolesIds: number[];
    rolesCommand: string;
}
