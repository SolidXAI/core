import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { ScheduledJob } from 'src/entities/scheduled-job.entity';
import { ScheduledJobRepository } from 'src/repository/scheduled-job.repository';
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';

@Injectable()
export class ScheduledJobService extends CRUDService<ScheduledJob> {
  private readonly logger = new Logger(ScheduledJobService.name);

  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(ScheduledJob)
    // readonly repo: Repository<ScheduledJob>,
    readonly repo: ScheduledJobRepository,
    readonly moduleRef: ModuleRef

  ) {
    super(entityManager, repo, 'scheduledJob', 'solid-core', moduleRef);
  }
}
