import { Injectable } from '@nestjs/common';
import { MediaMigrationItem } from 'src/entities/media-migration-item.entity';
import { DataSource } from 'typeorm';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class MediaMigrationItemRepository extends SolidBaseRepository<MediaMigrationItem> {
    constructor(readonly dataSource: DataSource) {
        super(MediaMigrationItem, dataSource, null, null);
    }
}
