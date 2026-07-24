import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { WorkflowStepExecution } from '../entities/workflow-step-execution.entity';

@Injectable()
export class WorkflowStepExecutionRepository extends SolidBaseRepository<WorkflowStepExecution> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(WorkflowStepExecution, dataSource, requestContextService, securityRuleRepository);
    }
}