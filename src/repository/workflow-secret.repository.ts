import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { WorkflowSecret } from '../entities/workflow-secret.entity';

@Injectable()
export class WorkflowSecretRepository extends SolidBaseRepository<WorkflowSecret> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(WorkflowSecret, dataSource, requestContextService, securityRuleRepository);
    }
}
