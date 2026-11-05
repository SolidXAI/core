import { Injectable } from '@nestjs/common';
import { MediaMigrationJob } from 'src/entities/media-migration-job.entity';
import { DataSource } from 'typeorm';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class MediaMigrationJobRepository extends SolidBaseRepository<MediaMigrationJob> {
    constructor(readonly dataSource: DataSource) {
        super(MediaMigrationJob, dataSource, null, null);
    }
}
