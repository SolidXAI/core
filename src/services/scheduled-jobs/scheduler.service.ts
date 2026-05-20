import { Injectable, Logger } from '@nestjs/common';
import { IsNull, LessThanOrEqual } from 'typeorm';

import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from 'src/entities/scheduled-job.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ScheduledJobRepository } from 'src/repository/scheduled-job.repository';
import { ISchedulerService } from './scheduler.interface';
import { CronExpressionParser } from 'cron-parser';

@Injectable()
export class SchedulerServiceImpl implements ISchedulerService {
    private readonly logger = new Logger(SchedulerServiceImpl.name);
    private readonly runningJobs = new Set<string>();

    constructor(
        // @InjectRepository(ScheduledJob)
        // private readonly scheduledJobRepo: Repository<ScheduledJob>,
        private readonly scheduledJobRepo: ScheduledJobRepository,
        private readonly solidRegistry: SolidRegistry,
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async runScheduledJobs(): Promise<void> {
        const solidSchedulerEnabled = process.env.SOLID_SCHEDULER_ENABLED || "true";
        if (solidSchedulerEnabled.toLowerCase() !== "true") {
            this.logger.debug('Solid scheduler is disabled via environment variable');
            return;
        }
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }
        const jobsRegexToEnable = (process.env.SOLID_SCHEDULER_JOBS_REGEX_TO_ENABLE || '').trim();
        let jobsRegex: RegExp | null = null;
        if (jobsRegexToEnable && jobsRegexToEnable !== "all") {
            try {
                jobsRegex = new RegExp(jobsRegexToEnable);
            } catch (error: any) {
                this.logger.error(`Invalid SOLID_SCHEDULER_JOBS_REGEX_TO_ENABLE regex "${jobsRegexToEnable}". Scheduler loop will skip this run.`);
                return;
            }
        }

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
            const jobKey = String(job.id ?? job.scheduleName ?? job.job);
            const jobName = String(job.job ?? '');

            if (jobsRegex && !jobsRegex.test(jobName)) {
                this.logger.log(`[${now.getTime()}]: scheduler service skipping job ${jobName} because it does not match SOLID_SCHEDULER_JOBS_REGEX_TO_ENABLE=${jobsRegexToEnable}`);
                continue;
            }

            if (this.runningJobs.has(jobKey)) {
                this.logger.log(`[${now.getTime()}]: scheduler service skipping job ${job.job} because a run is already in progress`);
                continue;
            }

            if (!this.shouldRunNow(job, now)) {
                this.logger.log(`[${now.getTime()}]: scheduler service skipping job ${job.job}`);
                continue;
            }

            const handler = this.solidRegistry.getScheduledJobProviderInstance(job.job);
            if (!handler) {
                this.logger.warn(`[${now.getTime()}]: scheduler service skipping because job handler not found: ${job.job}`);
                continue;
            }

            this.runningJobs.add(jobKey);
            this.logger.log(`[${now.getTime()}]: scheduler service attempting to run job ${job.job}`);
            try {
                // this.logger.log(`[${now.getTime()}]: scheduler service about to run job ${job.job}`);
                await handler.execute(job);
                // this.logger.log(`[${now.getTime()}]: scheduler service finished running job ${job.job}`);

                job.isActive = true;
                const finishedAt = new Date();
                job.lastRunAt = finishedAt;
                job.nextRunAt = this.computeNextRunAt(job, finishedAt);
                this.logger.log(`[${now.getTime()}]: scheduler service coomputed next run for ${job.job} as ${job.nextRunAt}`);

                await this.scheduledJobRepo.save(job);
                this.logger.log(`[${now.getTime()}]: scheduler service finished running job: ${job.job}`);
            } catch (err: any) {
                this.logger.error(`[${now.getTime()}]: scheduler service failed to run job ${job.job}`, err.stack);
            } finally {
                this.runningJobs.delete(jobKey);
            }
        }
    }

    private shouldRunNow(job: ScheduledJob, now: Date): boolean {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const timeNow = this.toHHMM(now); // hh:mm

        // 1. Check startDate / endDate
        const startDate = this.toDateOnly(job.startDate as unknown as Date | string | null);
        const endDate = this.toDateOnly(job.endDate as unknown as Date | string | null);
        if (startDate && today < startDate) return false;
        if (endDate && today > endDate) return false;

        // 2. Check startTime / endTime
        const jobStart = this.toHHMM(job.startTime as unknown as Date | string | null);
        const jobEnd = this.toHHMM(job.endTime as unknown as Date | string | null);
        if (jobStart && timeNow < jobStart) return false;
        if (jobEnd && timeNow > jobEnd) return false;

        // 3. Check custom frequency
        if (job.frequency.toLowerCase() === 'custom') {
            // Custom cron expressions handle their own scheduling logic
            // Just check if nextRunAt is due, which was already checked in the query
            return true;
        }

        // 3. Check dayOfWeek (for weekly)
        if (job.frequency.toLowerCase() === 'weekly' && job.dayOfWeek) {
            const todayName = now.toLocaleString('en-US', { weekday: 'long' }); // e.g., "Monday"
            const days = this.parseDayOfWeek(job.dayOfWeek);
            if (!days.includes(todayName)) return false;
        }

        // 4. Check dayOfMonth (for monthly)
        if (job.frequency.toLowerCase() === 'monthly' && job.dayOfMonth) {
            const dom = now.getDate();
            if (dom !== job.dayOfMonth) return false;
        }

        return true;
    }

    private parseDayOfWeek(dayOfWeek: string): string[] {
        try {
            const parsed = JSON.parse(dayOfWeek);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error: any) {
            this.logger.warn(`Invalid dayOfWeek JSON '${dayOfWeek}'`, error as any);
            return [];
        }
    }

    private toDateOnly(value: Date | string | null | undefined): Date | null {
        if (!value) return null;

        if (value instanceof Date) {
            const d = new Date(value);
            d.setHours(0, 0, 0, 0);
            return d;
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;

        parsed.setHours(0, 0, 0, 0);
        return parsed;
    }

    private toHHMM(value: Date | string | null | undefined): string | null {
        if (!value) return null;

        if (value instanceof Date) {
            return value.toTimeString().slice(0, 5);
        }

        if (typeof value === 'string') {
            const match = value.match(/^(\d{2}):(\d{2})/);
            if (match) return `${match[1]}:${match[2]}`;

            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toTimeString().slice(0, 5);
            }
        }

        return null;
    }

    public computeNextRunForCustomCron(job: ScheduledJob, from: Date): Date {
        const base = new Date(from);

        if (!job.cronExpression) {
            this.logger.error(`Custom frequency requires cronExpression for job ${job.scheduleName}`);
            // Fallback to daily if cron expression is missing
            return new Date(base.getTime() + 24 * 60 * 60 * 1000);
        }

        try {
            const interval = CronExpressionParser.parse(job.cronExpression, {
                currentDate: from,
                tz: 'UTC'
            });
            const nextRun = interval.next().toDate();
            const runAfterNext = interval.next().toDate();

            // Validate minimum 1 minute cadence between consecutive runs.
            // Comparing nextRun to "from" is incorrect near minute boundaries.
            if (runAfterNext.getTime() - nextRun.getTime() < 60000) {
                throw new Error('Cron expression interval must be at least 1 minute');
            }

            this.logger.log(`Custom cron '${job.cronExpression}' next run: ${nextRun}`);
            return nextRun;
        } catch (error: any) {
            this.logger.error(`Invalid cron expression for job ${job.scheduleName}: ${job.cronExpression}. Reason: ${(error as Error).message}`);
            // Fallback to daily if cron parsing fails
            return new Date(base.getTime() + 24 * 60 * 60 * 1000);
        }
    }

    public computeNextRunAt(job: ScheduledJob, from: Date): Date {
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
            case 'custom':
                return this.computeNextRunForCustomCron(job, from);
            default:
                return new Date(base.getTime() + 24 * 60 * 60 * 1000);
        }
    }
}
