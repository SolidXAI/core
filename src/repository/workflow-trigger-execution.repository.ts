import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { WorkflowTriggerExecution } from '../entities/workflow-trigger-execution.entity';

@Injectable()
export class WorkflowTriggerExecutionRepository extends SolidBaseRepository<WorkflowTriggerExecution> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(WorkflowTriggerExecution, dataSource, requestContextService, securityRuleRepository);
    }
}