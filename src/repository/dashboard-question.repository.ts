import { Injectable } from '@nestjs/common';
import { DashboardQuestion } from '../entities/dashboard-question.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class DashboardQuestionRepository extends SolidBaseRepository<DashboardQuestion> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(DashboardQuestion, dataSource, requestContextService, securityRuleRepository);
    }
}