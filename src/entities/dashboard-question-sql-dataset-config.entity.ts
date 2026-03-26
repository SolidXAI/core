import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DashboardQuestion } from 'src/entities/dashboard-question.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity("ss_dashboard_question_sql_dataset_config")
export class DashboardQuestionSqlDatasetConfig extends CommonEntity {
    @Index()
    @Column({ type: "varchar" })
    datasetName: string;

    @Column({ type: "varchar" })
    datasetDisplayName: string;

    @Column({ nullable: true })
    description: string;

    @Column({ ...getColumnType('longText'), nullable: true })
    sql: string;

    @Column({ type: "varchar" })
    labelColumnName: string;

    @Column({ type: "varchar" })
    valueColumnName: string;

    @ManyToOne(() => DashboardQuestion, { nullable: false })
    @JoinColumn()
    question: DashboardQuestion;

    @Column({ nullable: true, ...getColumnType('longText') })
    options: any;

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: false })
    externalId: string;
}
