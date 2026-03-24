import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Dashboard } from 'src/entities/dashboard.entity'

@Entity("ss_dashboard_variable")
export class DashboardVariable extends CommonEntity {
    @Index()
    @Column({ type: "varchar" })
    variableName: string;

    @Index()
    @Column({ type: "varchar" })
    variableType: string;

    @Column({ type: "simple-json", nullable: true })
    selectionStaticValues: any;

    @Column({ nullable: true })
    selectionDynamicSourceType: string;

    @Column({ type: "text", nullable: true })
    selectionDynamicSQL: string;

    @Column({ type: "varchar", nullable: true })
    selectionDynamicProviderName: string;

    @Column({ nullable: true, default: true })
    isMultiSelect: boolean = true;

    @ManyToOne(() => Dashboard, { nullable: true })
    @JoinColumn()
    dashboard: Dashboard;

    @Column({ type: "text", nullable: true })
    defaultValue: string;

    @Column({ type: "varchar", nullable: true })
    defaultOperator: string;

    @Index({ unique: true })
    @Column({ type: "varchar" })
    externalId: string;
}