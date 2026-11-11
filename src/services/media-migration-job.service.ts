import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { MediaMigrationJob } from 'src/entities/media-migration-job.entity';
import { MediaMigrationJobRepository } from 'src/repository/media-migration-job.repository';
import { CRUDService } from 'src/services/crud.service';

/** Read access to migration jobs for the admin list and form views. Jobs are created and run by the migration API. */
@Injectable()
export class MediaMigrationJobService extends CRUDService<MediaMigrationJob> {
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    readonly repo: MediaMigrationJobRepository,
    readonly moduleRef: ModuleRef,
  ) {
    super(entityManager, repo, 'mediaMigrationJob', 'solid-core', moduleRef);
  }
}
