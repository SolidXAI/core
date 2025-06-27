import { CommonEntity } from 'src/entities/common.entity'
import {Entity, Column, Index, JoinColumn, ManyToOne} from 'typeorm';
import { Dashboard } from 'src/entities/dashboard.entity'

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
    @Column({ type: "text", nullable: true })
    sql: string;
    @Column({ type: "varchar", nullable: true })
    providerName: string;
    @Column({ type: "varchar", nullable: true })
    barChartXKey: string;
    @Column({ type: "varchar", nullable: true })
    barChartSeriesKey: string;
    @Column({ type: "varchar", nullable: true })
    barChartValueKey: string;
    @Column({ type: "jsonb", nullable: true })
    barChartLabelOptions: any;
    @ManyToOne(() => Dashboard, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    dashboard: Dashboard;
}