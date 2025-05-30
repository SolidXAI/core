import { CommonEntity } from 'src/entities/common.entity'
import {Entity, Column, Index, JoinColumn, ManyToOne} from 'typeorm';
import { ImportTransaction } from 'src/entities/import-transaction.entity'

@Entity("ss_import_transaction_error_log")
export class ImportTransactionErrorLog extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    importTransactionErrorLogId: string;
    @Column({ type: "integer" })
    rowNumber: number;
    @Column({ type: "text", nullable: true })
    rowData: any;
    @Index()
    @ManyToOne(() => ImportTransaction, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    importTransaction: ImportTransaction;
    @Column({ type: "varchar" })
    errorMessage: string;
    @Column({ type: "text", nullable: true })
    errorTrace: string;
}