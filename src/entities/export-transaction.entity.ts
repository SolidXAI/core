import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, ManyToOne } from 'typeorm';
import { ExportTemplate } from 'src/entities/export-template.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';

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
    @Column({ nullable: true, ...getColumnType('longText') })
    error: string;
    @Index()
    @ManyToOne(() => ExportTemplate, { nullable: true })
    exportTemplate: ExportTemplate;
}