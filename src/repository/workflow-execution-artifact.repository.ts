import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { WorkflowExecutionArtifact } from '../entities/workflow-execution-artifact.entity';

@Injectable()
export class WorkflowExecutionArtifactRepository extends SolidBaseRepository<WorkflowExecutionArtifact> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(WorkflowExecutionArtifact, dataSource, requestContextService, securityRuleRepository);
    }
}