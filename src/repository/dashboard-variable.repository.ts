import { Injectable } from '@nestjs/common';
import { DashboardVariable } from '../entities/dashboard-variable.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class DashboardVariableRepository extends SolidBaseRepository<DashboardVariable> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(DashboardVariable, dataSource, requestContextService, securityRuleRepository);
    }
}