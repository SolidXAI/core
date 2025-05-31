import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, ManyToOne, Index, JoinTable, ManyToMany, JoinColumn } from "typeorm";
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { ActionMetadata } from 'src/entities/action-metadata.entity';
import { RoleMetadata } from 'src/entities/role-metadata.entity';

@Entity("ss_menu_item_metadata")
export class MenuItemMetadata extends CommonEntity {
    @Index({ unique: true })
    @Column({ name: "name", type: "varchar", unique: true })
    name: string;
    @Column({ name: "display_name", type: "varchar" })
    displayName: string;
    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: "CASCADE", nullable: false })
    @JoinColumn({ referencedColumnName: 'id' })
    module: ModuleMetadata;
    @Index()
    @ManyToOne(() => MenuItemMetadata, { onDelete: "CASCADE", nullable: true })
    @JoinColumn({ referencedColumnName: 'id' })
    parentMenuItem: MenuItemMetadata;
    @Index()
    @ManyToOne(() => ActionMetadata, { onDelete: "CASCADE", nullable: true })
    @JoinColumn({ referencedColumnName: 'id' })
    action: ActionMetadata;
    @ManyToMany(() => RoleMetadata, roleMetadata => roleMetadata.users, { cascade: true })
    @JoinTable()
    roles: RoleMetadata[];
    @Column({ name: "sequence_number", type: "int", nullable: true })
    sequenceNumber: number;

    @Column({ name: "icon_name", type: "varchar", nullable: true })
    iconName: string;

}