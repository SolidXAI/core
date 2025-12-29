import { CommonEntity } from "src/entities/common.entity"
import { Entity, JoinColumn, ManyToOne, Index, Column } from 'typeorm';
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { FieldMetadata } from 'src/entities/field-metadata.entity'

@Entity('ss_model_sequence')
export class ModelSequence extends CommonEntity {
    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    module: ModuleMetadata;
    @Index()
    @ManyToOne(() => ModelMetadata, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    model: ModelMetadata;
    @Index()
    @ManyToOne(() => FieldMetadata, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    field: FieldMetadata;
    @Index({ unique: true })
    @Column({ type: "varchar" })
    sequenceName: string;
    @Column({ type: "integer", default: 1 })
    currentValue: number;
    @Column({ type: "varchar", nullable: true })
    prefix: string;
    @Column({ type: "integer", default: 5 })
    padding: number;
    @Column({ type: "varchar", default: "" })
    separator: string;
}