import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, Index, ManyToMany } from "typeorm";
import { RoleMetadata } from 'src/entities/role-metadata.entity'

@Entity("ss_permission_metadata")
export class PermissionMetadata extends CommonEntity {
    @Index({ unique: true })
    @Column({ name: "name", type: "varchar" })
    name: string;

    @ManyToMany(() => RoleMetadata, roleMetadata => roleMetadata.permissions, { cascade: ['insert', 'update'] })
    roles: RoleMetadata[];
}