import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, OneToMany, JoinColumn, ManyToOne } from 'typeorm';
import { DashboardVariable } from 'src/entities/dashboard-variable.entity';
import { DashboardQuestion } from 'src/entities/dashboard-question.entity';
import { ModuleMetadata } from 'src/entities/module-metadata.entity'
import { DashboardLayout } from './dashboard-layout.entity';

@Entity("ss_dashboard")
export class Dashboard extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    name: string;

    @Column({ type: "text" })
    layoutJson: any;

    @OneToMany(() => DashboardVariable, dashboardVariable => dashboardVariable.dashboard, { cascade: true })
    dashboardVariables: DashboardVariable[];

    @OneToMany(() => DashboardQuestion, dashboardQuestion => dashboardQuestion.dashboard, { cascade: true })
    questions: DashboardQuestion[];

    @OneToMany(() => DashboardLayout, dashboardLayout => dashboardLayout.dashboard, { cascade: true })
    dashboardLayouts: DashboardLayout[];

    @ManyToOne(() => ModuleMetadata, { nullable: false })
    @JoinColumn()
    module: ModuleMetadata;

    @Column({ type: "varchar", nullable: true })
    displayName: string;

    @Column({ type: "text", nullable: true })
    description: string;
}