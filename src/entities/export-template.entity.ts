import { CommonEntity } from 'src/entities/common.entity'
import {Entity, Column, Index, ManyToOne} from 'typeorm';
import { ModelMetadata } from 'src/entities/model-metadata.entity'
@Entity("ss_export_template")
@Index(["templateName", "deletedTracker"], { unique: true })
export class ExportTemplate extends CommonEntity{
@Index()
@Column({ type: "varchar" })
templateName: string;

@Column({ type: "varchar" })
templateFormat: string;

@Column({ type: "boolean", nullable: true, default: true })
notifyOnEmail: boolean = true;

@Index()
@ManyToOne(() => ModelMetadata, { onDelete: "CASCADE", nullable: false })
modelId: ModelMetadata;

@Column({ type: "varchar" })
fields: any;
}