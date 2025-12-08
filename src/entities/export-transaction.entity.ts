import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, ManyToOne } from 'typeorm';
import { ExportTemplate } from 'src/entities/export-template.entity'

@Entity("ss_export_transaction")
@Index(["exportTransactionId", "deletedTracker"], { unique: true })
export class ExportTransaction extends CommonEntity {
    @Index()
    @Column({})
    datetime: Date;
    @Index()
    @Column({ type: "varchar" })
    exportTransactionId: string;
    @Index()
    @Column({ type: "varchar" })
    status: string;
    @Column({ type: "text", nullable: true })
    error: string;
    @Index()
    @ManyToOne(() => ExportTemplate, { nullable: true })
    exportTemplate: ExportTemplate;
}