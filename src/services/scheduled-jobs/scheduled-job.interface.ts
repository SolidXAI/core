import { ScheduledJob } from "src/entities/scheduled-job.entity";

export interface IScheduledJob {
    executeReminder(reminder: ScheduledJob): Promise<void>;
}
