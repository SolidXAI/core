import { ScheduledJob } from "src/entities/scheduled-job.entity";

export interface IScheduledJob {
    execute(job: ScheduledJob): Promise<void>;
}
