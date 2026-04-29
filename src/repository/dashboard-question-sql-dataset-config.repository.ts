import { Injectable } from '@nestjs/common';
import { DashboardQuestionSqlDatasetConfig } from '../entities/dashboard-question-sql-dataset-config.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class DashboardQuestionSqlDatasetConfigRepository extends SolidBaseRepository<DashboardQuestionSqlDatasetConfig> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(DashboardQuestionSqlDatasetConfig, dataSource, requestContextService, securityRuleRepository);
    }
}