import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { AgentProcess } from '../entities/agent-process.entity';

@Injectable()
export class AgentProcessRepository extends SolidBaseRepository<AgentProcess> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(AgentProcess, dataSource, requestContextService, securityRuleRepository);
    }
}