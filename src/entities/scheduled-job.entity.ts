import { Entity, Column } from 'typeorm';
import { CommonEntity } from './common.entity';

@Entity('ss_scheduled_job')
export class ScheduledJob extends CommonEntity {
    @Column({ type: "varchar" })
    scheduleName: string;
    @Column({ type: "boolean", default: false })
    isActive: boolean = false;
    @Column({ type: "varchar" })
    frequency: string;
    @Column({ type: "time", nullable: true })
    startTime: Date;
    @Column({ type: "time", nullable: true })
    endTime: Date;
    @Column({ type: "date", nullable: true })
    startDate: Date;
    @Column({ type: "date", nullable: true })
    endDate: Date;
    @Column({ type: "integer", nullable: true })
    dayOfMonth: number;
    @Column({ type: "timestamp", nullable: true })
    lastRunAt: Date;
    @Column({ type: "timestamp", nullable: true })
    nextRunAt: Date;
    @Column({ type: "varchar", nullable: true })
    dayOfWeek: string;
    @Column({ type: "varchar" })
    job: string;
}