import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, JoinTable, ManyToMany } from "typeorm";
import { PermissionMetadata } from 'src/entities/permission-metadata.entity';
import { User } from 'src/entities/user.entity';
import { MenuItemMetadata } from 'src/entities/menu-item-metadata.entity'
@Entity("ss_role_metadata")
export class RoleMetadata extends CommonEntity {
    @Column({ name: "name", type: "varchar", unique: true })
    name: string;

    @ManyToMany(() => PermissionMetadata, permissionMetadata => permissionMetadata.roles, { cascade: true })
    @JoinTable()
    permissions: PermissionMetadata[];

    @ManyToMany(() => User, user => user.roles, { cascade: ['insert', 'update'] })
    users: User[];

    @ManyToMany(() => MenuItemMetadata, menuItemMetadata => menuItemMetadata.roles, { cascade: ['insert', 'update'] })
    menuItems: MenuItemMetadata[];
}