import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, ManyToOne, Index, JoinTable, ManyToMany, JoinColumn } from "typeorm";
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { ActionMetadata } from 'src/entities/action-metadata.entity';
import { RoleMetadata } from "./role-metadata.entity";
@Entity("ss_menu_item_metadata")
export class MenuItemMetadata extends CommonEntity {
    @Column({ name: "name", type: "varchar", unique: true })
    name: string;

    @Column({ name: "display_name", type: "varchar" })
    displayName: string;

    @JoinColumn({ name: 'module_id', referencedColumnName: 'id' })
    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: "CASCADE" })
    module: ModuleMetadata;

    @JoinColumn({ name: 'parent_menu_item_id', referencedColumnName: 'id' })
    @Index()
    @ManyToOne(() => MenuItemMetadata, { onDelete: "CASCADE" })
    parentMenuItem: MenuItemMetadata;

    @JoinColumn({ name: 'action_id', referencedColumnName: 'id' })
    @Index()
    @ManyToOne(() => ActionMetadata, { onDelete: "CASCADE" })
    action: ActionMetadata;

    @ManyToMany(() => RoleMetadata, roleMetadata => roleMetadata.menuItems, { cascade: true })
    @JoinTable()
    roles: RoleMetadata[];

    @Column({ name: "sequence_number", type: "int", nullable: true })
    sequenceNumber: number;
}