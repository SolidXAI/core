import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, OneToMany, JoinColumn, ManyToOne } from 'typeorm';
import { DashboardVariable } from 'src/entities/dashboard-variable.entity';
import { Question } from 'src/entities/question.entity';
import { ModuleMetadata } from 'src/entities/module-metadata.entity'

@Entity("ss_dashboard")
export class Dashboard extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    name: string;
    @Column({ type: "text" })
    layoutJson: any;
    @OneToMany(() => DashboardVariable, dashboardVariable => dashboardVariable.dashboard, { cascade: true })
    dashboardVariables: DashboardVariable[];
    @OneToMany(() => Question, question => question.dashboard, { cascade: true })
    questions: Question[];
    @ManyToOne(() => ModuleMetadata, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    module: ModuleMetadata;
}