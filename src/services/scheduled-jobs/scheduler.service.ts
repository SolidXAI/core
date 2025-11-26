import { Injectable, Logger } from '@nestjs/common';
import { IsNull, LessThanOrEqual } from 'typeorm';

import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from 'src/entities/scheduled-job.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ScheduledJobRepository } from 'src/repository/scheduled-job.repository';
import { ISchedulerService } from './scheduler.interface';

@Injectable()
export class SchedulerServiceImpl implements ISchedulerService {
    private readonly logger = new Logger(SchedulerServiceImpl.name);

    constructor(
        // @InjectRepository(ScheduledJob)
        // private readonly scheduledJobRepo: Repository<ScheduledJob>,
        private readonly scheduledJobRepo: ScheduledJobRepository,
        private readonly solidRegistry: SolidRegistry,
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async runScheduledJobs(): Promise<void> {
        const now = new Date();

        // this.logger.log(`[${now.getTime()}]: scheduler service started run...`);
        const dueJobs = await this.scheduledJobRepo.find({
            where: [
                {
                    isActive: true,
                    nextRunAt: LessThanOrEqual(now),
                },
                // Newly created jobs are also picked for examination 
                {
                    isActive: true,
                    nextRunAt: IsNull(),
                },
            ],
        });

        // this.logger.log(`[${now.getTime()}]: scheduler service identified ${dueJobs.length} jobs to run...`);

        for (const job of dueJobs) {
            this.logger.log(`[${now.getTime()}]: scheduler service attempting to run job ${job.job}`);
            try {
                if (!this.shouldRunNow(job, now)) {
                    this.logger.log(`[${now.getTime()}]: scheduler service skipping job ${job.job}`);
                    continue;
                }

                const handler = this.solidRegistry.getScheduledJobProviderInstance(job.job);
                if (!handler) {
                    // this.logger.warn(`[${now.getTime()}]: scheduler service skipping because job handler not found: ${job.job}`);
                    continue;
                }

                // this.logger.log(`[${now.getTime()}]: scheduler service about to run job ${job.job}`);
                await handler.execute(job);
                // this.logger.log(`[${now.getTime()}]: scheduler service finished running job ${job.job}`);

                job.isActive = true;
                job.lastRunAt = now;
                job.nextRunAt = this.computeNextRunAt(job, now);
                this.logger.log(`[${now.getTime()}]: scheduler service coomputed next run for ${job.job} as ${job.nextRunAt}`);

                await this.scheduledJobRepo.save(job);
                this.logger.log(`[${now.getTime()}]: scheduler service finished running job: ${job.job}`);
            } catch (err) {
                this.logger.error(`[${now.getTime()}]: scheduler service failed to run job ${job.job}`, err.stack);
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