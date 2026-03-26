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

    //TODO: To make this truly cross db compatible, we should avoid setting a db type
    @Column({ name: "context", type: "text" })
    context: any = "{}";

    //TODO: To make this truly cross db compatible, we should avoid setting a db type
    @Column({ name: "layout", type: "text" })
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