import { Injectable } from '@nestjs/common';
import { ActionMetadata } from 'src/entities/action-metadata.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class ActionMetadataRepository extends SolidBaseRepository<ActionMetadata> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ActionMetadata, dataSource, requestContextService, securityRuleRepository);
    }
}