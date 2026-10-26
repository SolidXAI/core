import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestContextService } from 'src/services/request-context.service';
import { AgentUserMemory } from 'src/entities/agent-user-memory.entity';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class AgentUserMemoryRepository extends SolidBaseRepository<AgentUserMemory> {
  constructor(
    @InjectDataSource('default') readonly dataSource: DataSource,
    readonly requestContextService: RequestContextService,
    readonly securityRuleRepository: SecurityRuleRepository,
  ) {
    super(AgentUserMemory, dataSource, requestContextService, securityRuleRepository);
  }
}
