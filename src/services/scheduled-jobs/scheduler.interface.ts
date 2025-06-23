export interface ISchedulerService {
    runScheduledJobs(): Promise<void>;
}