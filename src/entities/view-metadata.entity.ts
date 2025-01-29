import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, ManyToOne, Index, JoinColumn } from "typeorm";
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity'
@Entity("ss_view_metadata")
export class ViewMetadata extends CommonEntity {
    @Column({ name: "name", type: "varchar", unique: true })
    name: string;

    @Column({ name: "display_name", type: "varchar" })
    displayName: string;

    @Column({ name: "type", type: "varchar" })
    type: string;

    @Column({ name: "context", type: "text" })
    context: any;

    @Column({ name: "layout", type: "text" })
    layout: any;

    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: "CASCADE" })
    @JoinColumn({ name: 'module_id', referencedColumnName: 'id' })
    module: ModuleMetadata;

    @Index()
    @ManyToOne(() => ModelMetadata, { onDelete: "CASCADE" })
    @JoinColumn({ name: 'model_id', referencedColumnName: 'id' })
    model: ModelMetadata;
}