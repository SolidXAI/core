import { CommonEntity } from 'src/entities/common.entity'
import {Entity, Column, Index, JoinColumn, ManyToOne} from 'typeorm';
import { Dashboard } from 'src/entities/dashboard.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity("ss_dashboard_variable")
export class DashboardVariable extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    variableName: string;

    @Index()
    @Column({ type: "varchar" })
    variableType: string;

    @Column({ type: "simple-json", nullable: true })
    selectionStaticValues: any;

    @Column({ nullable: true })
    selectionDynamicSourceType: string;

    @Column({ nullable: true, ...getColumnType('longText') })
    selectionDynamicSQL: string;

    @Column({ type: "varchar", nullable: true })
    selectionDynamicProviderName: string;

    @Column({ nullable: true, default: true })
    isMultiSelect: boolean = true;

    @ManyToOne(() => Dashboard, { nullable: true })
    @JoinColumn()
    dashboard: Dashboard;

    @Column({ nullable: true})
    defaultValue: string;

    @Column({ type: "varchar", nullable: true })
    defaultOperator: string;
}