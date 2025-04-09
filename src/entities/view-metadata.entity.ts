import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, ManyToOne, Index, JoinColumn, OneToMany } from "typeorm";
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { UserViewMetadata } from 'src/entities/user-view-metadata.entity'

@Entity("ss_view_metadata")
export class ViewMetadata extends CommonEntity {
    @Index({ unique: true })
    @Column({ name: "name", type: "varchar", unique: true })
    name: string;
    @Column({ name: "display_name", type: "varchar" })
    displayName: string;
    @Column({ name: "type", type: "varchar" })
    type: string;
    @Column({ name: "context", type: "text" })
    context: any = "{}";
    @Column({ name: "layout", type: "text" })
    layout: any;
    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: "CASCADE", nullable: false })
    @JoinColumn({ referencedColumnName: 'id' })
    module: ModuleMetadata;
    @Index()
    @ManyToOne(() => ModelMetadata, { onDelete: "CASCADE", nullable: false })
    @JoinColumn({ referencedColumnName: 'id' })
    model: ModelMetadata;
    @OneToMany(() => UserViewMetadata, userViewMetadata => userViewMetadata.viewMetadata, { cascade: true })
    userViewMetadata: UserViewMetadata[];
}