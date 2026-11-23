import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { AgentBrowserSession } from '../entities/agent-browser-session.entity';

@Injectable()
export class AgentBrowserSessionRepository extends SolidBaseRepository<AgentBrowserSession> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(AgentBrowserSession, dataSource, requestContextService, securityRuleRepository);
    }
}
