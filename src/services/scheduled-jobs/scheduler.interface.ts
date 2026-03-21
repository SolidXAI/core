import { ScheduledJob } from "src/entities/scheduled-job.entity";

export interface ISchedulerService {
    runScheduledJobs(): Promise<void>;
    computeNextRunAt(job: ScheduledJob, from: Date): Date;
}
