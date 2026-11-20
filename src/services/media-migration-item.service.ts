import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { MediaMigrationItem } from 'src/entities/media-migration-item.entity';
import { MediaMigrationItemRepository } from 'src/repository/media-migration-item.repository';
import { CRUDService } from 'src/services/crud.service';

/** Read access to the per-file results of a migration job for the admin list and form views. */
@Injectable()
export class MediaMigrationItemService extends CRUDService<MediaMigrationItem> {
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    readonly repo: MediaMigrationItemRepository,
    readonly moduleRef: ModuleRef,
  ) {
    super(entityManager, repo, 'mediaMigrationItem', 'solid-core', moduleRef);
  }
}
