import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { ScheduledJob } from 'src/entities/scheduled-job.entity';
import { ScheduledJobRepository } from 'src/repository/scheduled-job.repository';
import { EntityManager } from 'typeorm';
import { CrudHelperService } from './crud-helper.service';
import { CRUDService } from './crud.service';
import { FileService } from './file.service';
import { ModelMetadataService } from './model-metadata.service';
import { ModuleMetadataService } from './module-metadata.service';

@Injectable()
export class ScheduledJobService extends CRUDService<ScheduledJob> {
  private readonly logger = new Logger(ScheduledJobService.name);

  constructor(
    @Inject(forwardRef(() => ModelMetadataService))
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(ScheduledJob)
    // readonly repo: Repository<ScheduledJob>,
    readonly repo: ScheduledJobRepository,
    readonly moduleRef: ModuleRef

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'scheduledJob', 'solid-core', moduleRef);
  }
}
