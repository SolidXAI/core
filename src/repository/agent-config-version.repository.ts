import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestContextService } from 'src/services/request-context.service';
import { AgentConfigVersion } from '../entities/agent-config-version.entity';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class AgentConfigVersionRepository extends SolidBaseRepository<AgentConfigVersion> {
    constructor(
        @InjectDataSource('default')
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(AgentConfigVersion, dataSource, requestContextService, securityRuleRepository);
    }
}
