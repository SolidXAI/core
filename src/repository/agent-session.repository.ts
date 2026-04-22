import { Injectable } from '@nestjs/common';
import { AgentSession } from 'src/entities/agent-session.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class AgentSessionRepository extends SolidBaseRepository<AgentSession> {
  constructor(
    readonly dataSource: DataSource,
    readonly requestContextService: RequestContextService,
    readonly securityRuleRepository: SecurityRuleRepository,
  ) {
    super(AgentSession, dataSource, requestContextService, securityRuleRepository);
  }
}
