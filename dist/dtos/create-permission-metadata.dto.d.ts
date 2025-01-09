import { UpdateRoleMetadataDto } from 'src/dtos/update-role-metadata.dto';
export declare class CreatePermissionMetadataDto {
    name: string;
    roles: UpdateRoleMetadataDto[];
    rolesIds: number[];
    rolesCommand: string;
}
