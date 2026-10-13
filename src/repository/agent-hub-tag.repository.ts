import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestContextService } from 'src/services/request-context.service';
import { AgentHubTag } from '../entities/agent-hub-tag.entity';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class AgentHubTagRepository extends SolidBaseRepository<AgentHubTag> {
    constructor(
        @InjectDataSource('default')
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(AgentHubTag, dataSource, requestContextService, securityRuleRepository);
    }
}
