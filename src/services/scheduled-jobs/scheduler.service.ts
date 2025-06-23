import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { ISchedulerService } from './scheduler.interface';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ScheduledJob } from 'src/entities/scheduled-job.entity';
import { IScheduledJob } from './scheduled-job.interface';

@Injectable()
export class SchedulerServiceImpl implements ISchedulerService {
    private readonly logger = new Logger(SchedulerServiceImpl.name);

    constructor(
        @InjectRepository(ScheduledJob)
        private readonly scheduledJobRepo: Repository<ScheduledJob>,
        private readonly solidRegistry: SolidRegistry,
    ) { }

    async runScheduledJobs(): Promise<void> {
        const now = new Date();

        const dueScheduledJobs = await this.scheduledJobRepo.find({
            where: {
                isActive: true,
                nextRunAt: LessThanOrEqual(now),
            },
        });

        for (const dueScheduledJob of dueScheduledJobs) {
            try {
                const jobName = dueScheduledJob.job;
                // @ts-ignore                
                // const jobHandler = this.jobMap[jobName];
                // const jobHandler = ''; 
                const jobHandler: IScheduledJob | undefined = this.solidRegistry.getScheduledJobProviderInstance(jobName)

                if (!jobHandler) {
                    this.logger.warn(`No job service found for: ${jobName}`);
                    continue;
                }

                await jobHandler.executeReminder(dueScheduledJob);

                // Update nextRunAt and lastRunAt based on frequency
                dueScheduledJob.lastRunAt = now;
                dueScheduledJob.nextRunAt = this.computeNextRunAt(dueScheduledJob); // implement as needed
                await this.scheduledJobRepo.save(dueScheduledJob);

                this.logger.log(`Successfully ran job: ${jobName}`);
            } catch (err) {
                this.logger.error(`Failed to run job for reminder ${dueScheduledJob.id}`, err.stack);
            }
        }
    }

    private computeNextRunAt(reminder: ScheduledJob): Date {
        const now = new Date();
        switch (reminder.frequency) {
            case 'daily':
                return new Date(now.getTime() + 24 * 60 * 60 * 1000);
            case 'weekly':
                return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            case 'monthly':
                return new Date(now.setMonth(now.getMonth() + 1));
            default:
                return new Date(now.getTime() + 24 * 60 * 60 * 1000); // default fallback
        }
    }
}