import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, JoinTable, ManyToMany, Index, JoinColumn, ManyToOne } from "typeorm";
import { PermissionMetadata } from 'src/entities/permission-metadata.entity';
import { User } from 'src/entities/user.entity';
import { MenuItemMetadata } from 'src/entities/menu-item-metadata.entity';
import { ModuleMetadata } from 'src/entities/module-metadata.entity'

@Entity("ss_role_metadata")
export class RoleMetadata extends CommonEntity {
    @Index({ unique: true })
    @Column({ name: "name", type: "varchar"})
    name: string;

    @ManyToMany(() => PermissionMetadata, permissionMetadata => permissionMetadata.roles, { cascade: true })
    @JoinTable()
    permissions: PermissionMetadata[];

    @ManyToMany(() => User, user => user.roles, { cascade: ['insert', 'update'] })
    users: User[];

    @ManyToMany(() => MenuItemMetadata, menuItemMetadata => menuItemMetadata.roles, { cascade: ['insert', 'update'] })
    menuItems: MenuItemMetadata[];

    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    module: ModuleMetadata;
}