import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { ViewMetadata } from 'src/entities/view-metadata.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';
@Entity("ss_action_metadata")
export class ActionMetadata extends CommonEntity {
    @Column({ name: "name", type: "varchar", unique: true })
    name: string;

    @Index()
    @Column({ name: "display_name", type: "varchar" })
    displayName: string;

    @Index()
    @Column({ name: "type", type: "varchar" })
    type: string;

    @Column({ name: "domain", type: "text", nullable: true})
    domain: any;

    @Column({ name: "context", type: "text", nullable: true})
    context: any;

    @Column({ name: "custom_component", type: "varchar", nullable: true })
    customComponent: string;

    @Column({ name: "custom_is_modal", nullable: true })
    customIsModal: boolean;

    @Column({ name: "server_endpoint", type: "varchar", nullable: true })
    serverEndpoint: string;

    @Index()
    @ManyToOne(() => ModuleMetadata, {})
    @JoinColumn({ name: 'module_id', referencedColumnName: 'id' })
    module: ModuleMetadata;

    @Index()
    @ManyToOne(() => ModelMetadata, {})
    @JoinColumn({ name: 'model_id', referencedColumnName: 'id' })
    model: ModelMetadata;

    @Index()
    @ManyToOne(() => ViewMetadata, {})
    @JoinColumn({ name: 'view_id', referencedColumnName: 'id' })
    view: ViewMetadata;
}