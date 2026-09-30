import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from '@solidxai/core';
import { SolidBaseRepository } from '@solidxai/core' ;
import { RequestContextService } from '@solidxai/core';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { AgentHubSession } from '../entities/agent-hub-session.entity';

@Injectable()
export class AgentHubSessionRepository extends SolidBaseRepository<AgentHubSession> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(AgentHubSession, dataSource, requestContextService, securityRuleRepository);
    }
}