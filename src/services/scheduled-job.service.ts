import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { ScheduledJob } from 'src/entities/scheduled-job.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ScheduledJobRepository } from 'src/repository/scheduled-job.repository';
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { SchedulerServiceImpl } from './scheduled-jobs/scheduler.service';

@Injectable()
export class ScheduledJobService extends CRUDService<ScheduledJob> {
  private readonly logger = new Logger(ScheduledJobService.name);

  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(ScheduledJob)
    // readonly repo: Repository<ScheduledJob>,
    readonly repo: ScheduledJobRepository,
    readonly moduleRef: ModuleRef,
    private readonly solidRegistry: SolidRegistry,
    private readonly schedulerService: SchedulerServiceImpl,

  ) {
    super(entityManager, repo, 'scheduledJob', 'solid-core', moduleRef);
  }

  async triggerRun(id: number): Promise<ScheduledJob> {
    const job = await this.repo.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Scheduled job with id ${id} not found`);
    }

    const handler = this.solidRegistry.getScheduledJobProviderInstance(job.job);
    if (!handler) {
      throw new BadRequestException(`Scheduled job handler not found: ${job.job}`);
    }

    this.logger.log(`Manually triggering scheduled job id=${job.id}, job=${job.job}`);

    await handler.execute(job);

    const finishedAt = new Date();
    job.lastRunAt = finishedAt;
    job.nextRunAt = this.schedulerService.computeNextRunAt(job, finishedAt);
    await this.repo.save(job);

    this.logger.log(`Completed manual trigger for scheduled job id=${job.id}, nextRunAt=${job.nextRunAt?.toISOString?.()}`);

    return job;
  }
}
