import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { getColumnType } from 'src/helpers/typeorm-db-helper';
import { Dashboard } from 'src/entities/dashboard.entity';
import { DashboardQuestionSqlDatasetConfig } from 'src/entities/dashboard-question-sql-dataset-config.entity'

@Entity("ss_dashboard_question")
export class DashboardQuestion extends CommonEntity {
    @Index()
    @Column({ type: "varchar" })
    name: string;

    @Index()
    @Column({})
    sourceType: string;

    @Index()
    @Column({})
    visualisedAs: string;

    @Column({ type: "varchar", nullable: true })
    providerName: string;

    @ManyToOne(() => Dashboard, { nullable: true })
    @JoinColumn()
    dashboard: Dashboard;

    @OneToMany(() => DashboardQuestionSqlDatasetConfig, dashboardQuestionSqlDatasetConfig => dashboardQuestionSqlDatasetConfig.question, { cascade: true })
    questionSqlDatasetConfigs: DashboardQuestionSqlDatasetConfig[];

    @Column({ type: "simple-json", nullable: true, ...getColumnType('simpleJsonLargeText') })
    chartOptions: any;

    @Column({ nullable: true, ...getColumnType('longText') })
    labelSql: string;

    @Column({ nullable: true, ...getColumnType('longText') })
    kpiSql: string;

    @Column({ type: "integer", nullable: true })
    sequenceNumber: number;

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: false })
    externalId: string;
}