import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { Dashboard } from 'src/entities/dashboard.entity'
import { User } from './user.entity';

@Entity("ss_dashboard_layout")
export class DashboardLayout extends CommonEntity {
    @Column({ type: "text", nullable: true })
    layout: string;

    @ManyToOne(() => Dashboard, { nullable: true })
    @JoinColumn()
    dashboard: Dashboard;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn()
    user: User;
}