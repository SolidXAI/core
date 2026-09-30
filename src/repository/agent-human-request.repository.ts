import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from '@solidxai/core';
import { SolidBaseRepository } from '@solidxai/core' ;
import { RequestContextService } from '@solidxai/core';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { AgentHumanRequest } from '../entities/agent-human-request.entity';

@Injectable()
export class AgentHumanRequestRepository extends SolidBaseRepository<AgentHumanRequest> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(AgentHumanRequest, dataSource, requestContextService, securityRuleRepository);
    }
}