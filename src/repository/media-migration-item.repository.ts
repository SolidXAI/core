import { Injectable } from '@nestjs/common';
import { MediaMigrationItem } from 'src/entities/media-migration-item.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class MediaMigrationItemRepository extends SolidBaseRepository<MediaMigrationItem> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(MediaMigrationItem, dataSource, requestContextService, securityRuleRepository);
    }
}
