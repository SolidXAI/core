import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, ManyToOne, Index, JoinColumn, OneToMany } from "typeorm";
import { getColumnType } from 'src/helpers/typeorm-db-helper';
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { UserViewMetadata } from 'src/entities/user-view-metadata.entity'

@Entity("ss_view_metadata")
export class ViewMetadata extends CommonEntity {
    @Index({ unique: true })
    @Column({ name: "name", type: "varchar"})
    name: string;

    @Column({ name: "display_name", type: "varchar" })
    displayName: string;

    @Column({ name: "type", type: "varchar" })
    type: string;

    @Column({ name: "context", ...getColumnType('longText') })
    context: any = "{}";

    @Column({ name: "layout", ...getColumnType('longText') })
    layout: any;

    @Index()
    @ManyToOne(() => ModuleMetadata, { nullable: false })
    @JoinColumn({ referencedColumnName: 'id' })
    module: ModuleMetadata;

    @Index()
    @ManyToOne(() => ModelMetadata, { nullable: false })
    @JoinColumn({ referencedColumnName: 'id' })
    model: ModelMetadata;

    @OneToMany(() => UserViewMetadata, userViewMetadata => userViewMetadata.viewMetadata, { cascade: true })
    userViewMetadata: UserViewMetadata[];
}