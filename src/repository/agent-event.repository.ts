import { Injectable } from '@nestjs/common';
import { AgentEvent } from 'src/entities/agent-event.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class AgentEventRepository extends SolidBaseRepository<AgentEvent> {
  constructor(
    readonly dataSource: DataSource,
    readonly requestContextService: RequestContextService,
    readonly securityRuleRepository: SecurityRuleRepository,
  ) {
    super(AgentEvent, dataSource, requestContextService, securityRuleRepository);
  }
}
