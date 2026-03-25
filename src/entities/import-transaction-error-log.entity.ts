import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ImportTransaction } from 'src/entities/import-transaction.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity("ss_import_transaction_error_log")
export class ImportTransactionErrorLog extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    importTransactionErrorLogId: string;
    @Column({ type: "integer" })
    rowNumber: number;
    @Column({ nullable: true, ...getColumnType('longText') })
    rowData: any;
    @Index()
    @ManyToOne(() => ImportTransaction, { nullable: false })
    @JoinColumn()
    importTransaction: ImportTransaction;
    @Column({ type: "varchar" })
    errorMessage: string;
    @Column({ nullable: true, ...getColumnType('longText') })
    errorTrace: string;
}