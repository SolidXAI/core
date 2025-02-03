import { CommonEntity } from 'src/entities/common.entity'
import {Entity, Column, Index} from 'typeorm'
@Entity("ss_export_transaction")
@Index(["exportTransactionId", "deletedTracker"], { unique: true })
export class ExportTransaction extends CommonEntity{
@Index()
@Column({ type: "timestamp" })
datetime: Date;

@Index()
@Column({ type: "varchar" })
exportTransactionId: string;

@Index()
@Column({ type: "varchar" })
status: string;
}