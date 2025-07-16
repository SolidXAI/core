import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DashboardQuestion } from 'src/entities/dashboard-question.entity'

@Entity("ss_dashboard_question_sql_dataset_config")
export class DashboardQuestionSqlDatasetConfig extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    datasetName: string;
    @Column({ type: "varchar" })
    datasetDisplayName: string;
    @Column({ type: "text", nullable: true })
    description: string;
    @Column({ type: "text" })
    sql: string;
    @Column({ type: "varchar" })
    labelColumnName: string;
    @Column({ type: "varchar" })
    valueColumnName: string;
    @ManyToOne(() => DashboardQuestion, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    question: DashboardQuestion;
    @Column({ type: "text", nullable: true })
    options: any;
}