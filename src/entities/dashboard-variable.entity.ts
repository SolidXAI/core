import { CommonEntity } from 'src/entities/common.entity'
import {Entity, Column, Index, JoinColumn, ManyToOne} from 'typeorm';
import { Dashboard } from 'src/entities/dashboard.entity'

@Entity("ss_dashboard_variable")
export class DashboardVariable extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    variableName: string;
    @Index()
    @Column({ type: "varchar" })
    variableType: string;
    @Column({ type: "jsonb", nullable: true })
    selectionStaticValues: any;
    @Column({ nullable: true })
    selectionDynamicSourceType: string;
    @Column({ type: "text", nullable: true })
    selectionDynamicSQL: string;
    @Column({ type: "varchar", nullable: true })
    selectionDynamicProviderName: string;
    @Column({ type: "boolean", nullable: true, default: true })
    isMultiSelect: boolean = true;
    @ManyToOne(() => Dashboard, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    dashboard: Dashboard;
}