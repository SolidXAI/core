import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { WorkflowExecutionLog } from '../entities/workflow-execution-log.entity';

@Injectable()
export class WorkflowExecutionLogRepository extends SolidBaseRepository<WorkflowExecutionLog> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(WorkflowExecutionLog, dataSource, requestContextService, securityRuleRepository);
    }
}