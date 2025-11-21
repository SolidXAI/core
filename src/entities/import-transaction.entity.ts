import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { ImportTransactionErrorLog } from 'src/entities/import-transaction-error-log.entity'

@Entity("ss_import_transaction")
export class ImportTransaction extends CommonEntity {
    @Index()
    @Column({ type: "varchar", nullable: true, default: "draft" })
    status: string = "draft";
    @Column({ type: "text", nullable: true })
    mapping: any;
    @Index()
    @ManyToOne(() => ModelMetadata, { nullable: true })
    @JoinColumn()
    modelMetadata: ModelMetadata;
    @OneToMany(() => ImportTransactionErrorLog, importTransactionErrorLog => importTransactionErrorLog.importTransaction, { cascade: true })
    importTransactionErrorLog: ImportTransactionErrorLog[];
}