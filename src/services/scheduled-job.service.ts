import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';
import { ScheduledJob } from 'src/entities/scheduled-job.entity';
import { ModelMetadataService } from './model-metadata.service';
import { ModuleMetadataService } from './module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from './file.service';
import { CrudHelperService } from './crud-helper.service';
import { CRUDService } from './crud.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class ScheduledJobService extends CRUDService<ScheduledJob> {
  private readonly logger = new Logger(ScheduledJobService.name);

  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(ScheduledJob)
    readonly repo: Repository<ScheduledJob>,
    readonly moduleRef: ModuleRef

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'scheduledJob', 'solid-core', moduleRef);
  }
}
