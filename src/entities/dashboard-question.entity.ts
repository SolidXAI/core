import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
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

    @Column({ type: "simple-json", nullable: true })
    chartOptions: any;

    @Column({ type: "text", nullable: true })
    labelSql: string;

    @Column({ type: "text", nullable: true })
    kpiSql: string;

    @Column({ type: "integer", nullable: true })
    sequenceNumber: number;

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: false })
    externalId: string;
}