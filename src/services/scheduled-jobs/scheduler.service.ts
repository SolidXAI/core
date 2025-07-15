import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { ISchedulerService } from './scheduler.interface';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ScheduledJob } from 'src/entities/scheduled-job.entity';
import { IScheduledJob } from './scheduled-job.interface';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SchedulerServiceImpl implements ISchedulerService {
    private readonly logger = new Logger(SchedulerServiceImpl.name);

    constructor(
        @InjectRepository(ScheduledJob)
        private readonly scheduledJobRepo: Repository<ScheduledJob>,
        private readonly solidRegistry: SolidRegistry,
    ) { }

    // @Cron(CronExpression.EVERY_MINUTE)
    // async runScheduledJobs(): Promise<void> {
    //     const now = new Date();

    //     const dueScheduledJobs = await this.scheduledJobRepo.find({
    //         where: {
    //             isActive: true,
    //             nextRunAt: LessThanOrEqual(now),
    //         },
    //     });

    //     for (const dueScheduledJob of dueScheduledJobs) {
    //         try {
    //             const jobName = dueScheduledJob.job;
    //             // @ts-ignore                
    //             // const jobHandler = this.jobMap[jobName];
    //             // const jobHandler = ''; 
    //             const jobHandler: IScheduledJob | undefined = this.solidRegistry.getScheduledJobProviderInstance(jobName)

    //             if (!jobHandler) {
    //                 this.logger.warn(`No job service found for: ${jobName}`);
    //                 continue;
    //             }

    //             await jobHandler.executeReminder(dueScheduledJob);

    //             // Update nextRunAt and lastRunAt based on frequency
    //             dueScheduledJob.lastRunAt = now;
    //             dueScheduledJob.nextRunAt = this.computeNextRunAt(dueScheduledJob);
    //             await this.scheduledJobRepo.save(dueScheduledJob);

    //             this.logger.log(`Successfully ran job: ${jobName}`);
    //         } catch (err) {
    //             this.logger.error(`Failed to run job for reminder ${dueScheduledJob.id}`, err.stack);
    //         }
    //     }
    // }

    // private computeNextRunAt(reminder: ScheduledJob): Date {
    //     const now = new Date();
    //     switch (reminder.frequency) {
    //         case 'daily':
    //             return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    //         case 'weekly':
    //             return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    //         case 'monthly':
    //             return new Date(now.setMonth(now.getMonth() + 1));
    //         default:
    //             return new Date(now.getTime() + 24 * 60 * 60 * 1000); // default fallback
    //     }
    // }

    @Cron(CronExpression.EVERY_MINUTE)
    async runScheduledJobs(): Promise<void> {
        const now = new Date();
        const dueJobs = await this.scheduledJobRepo.find({
            where: {
                isActive: true,
                nextRunAt: LessThanOrEqual(now),
            },
        });

        for (const job of dueJobs) {
            try {
                if (!this.shouldRunNow(job, now)) {
                    continue;
                }

                const handler = this.solidRegistry.getScheduledJobProviderInstance(job.job);
                if (!handler) {
                    this.logger.warn(`No job handler found for job: ${job.job}`);
                    continue;
                }

                await handler.executeReminder(job);
                job.isActive = true;
                job.lastRunAt = now;
                job.nextRunAt = this.computeNextRunAt(job, now);
                await this.scheduledJobRepo.save(job);
                this.logger.log(`Successfully ran job: ${job.job}`);
            } catch (err) {
                this.logger.error(`Failed to run job ${job.job}`, err.stack);
            }
        }
    }

    private shouldRunNow(job: ScheduledJob, now: Date): boolean {
        const today = now.toISOString().split('T')[0]; // yyyy-mm-dd
        const timeNow = now.toTimeString().slice(0, 5); // hh:mm

        // 1. Check startDate / endDate
        if (job.startDate && new Date(today) < new Date(job.startDate)) return false;
        if (job.endDate && new Date(today) > new Date(job.endDate)) return false;

        // 2. Check startTime / endTime
        if (job.startTime) {
            const jobStart = job.startTime.toTimeString().slice(0, 5);
            if (timeNow < jobStart) return false;
        }
        if (job.endTime) {
            const jobEnd = job.endTime.toTimeString().slice(0, 5);
            if (timeNow > jobEnd) return false;
        }

        // 3. Check dayOfWeek (for weekly)
        if (job.frequency.toLowerCase() === 'weekly' && job.dayOfWeek) {
            const todayName = now.toLocaleString('en-US', { weekday: 'long' }); // e.g., "Monday"
            // const days = job.dayOfWeek.split(',').map(d => d.trim());
            const days = JSON.parse(job.dayOfWeek) as string[];
            if (!days.includes(todayName)) return false;
        }

        // 4. Check dayOfMonth (for monthly)
        if (job.frequency.toLowerCase() === 'monthly' && job.dayOfMonth) {
            const dom = now.getDate();
            if (dom !== job.dayOfMonth) return false;
        }

        return true;
    }

    private computeNextRunAt(job: ScheduledJob, from: Date): Date {
        const base = new Date(from);

        switch (job.frequency.toLowerCase()) {
            // case 'once':
            //     return null; // don't reschedule
            case 'every minute':
                return new Date(base.getTime() + 1 * 60 * 1000);
            case 'hourly':
                return new Date(base.getTime() + 60 * 60 * 1000);
            case 'daily':
                return new Date(base.getTime() + 24 * 60 * 60 * 1000);
            case 'weekly':
                return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
            case 'monthly':
                const next = new Date(base);
                next.setMonth(base.getMonth() + 1);
                return next;
            // case 'custom':
            //     // Optional: let job handler decide via metadata or registry
            //     return new Date(base.getTime() + 24 * 60 * 60 * 1000);
            default:
                return new Date(base.getTime() + 24 * 60 * 60 * 1000);
        }
    }
}