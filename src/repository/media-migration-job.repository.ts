import { Injectable } from '@nestjs/common';
import { MediaMigrationJob } from 'src/entities/media-migration-job.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class MediaMigrationJobRepository extends SolidBaseRepository<MediaMigrationJob> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(MediaMigrationJob, dataSource, requestContextService, securityRuleRepository);
    }
}
