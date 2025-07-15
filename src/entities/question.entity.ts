import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Dashboard } from 'src/entities/dashboard.entity';
import { QuestionSqlDatasetConfig } from 'src/entities/question-sql-dataset-config.entity'

@Entity("ss_question")
export class Question extends CommonEntity {
    @Index({ unique: true })
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
    @ManyToOne(() => Dashboard, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    dashboard: Dashboard;
    @OneToMany(() => QuestionSqlDatasetConfig, questionSqlDatasetConfig => questionSqlDatasetConfig.question, { cascade: true })
    questionSqlDatasetConfigs: QuestionSqlDatasetConfig[];
    @Column({ type: "jsonb", nullable: true })
    chartOptions: any;
    @Column({ type: "text", nullable: true })
    labelSql: string;
    @Column({ type: "text", nullable: true })
    kpiSql: string;
}