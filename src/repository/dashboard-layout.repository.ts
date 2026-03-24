import { Injectable } from '@nestjs/common';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';
import { DashboardLayout } from 'src/entities/dashboard-layout.entity';

@Injectable()
export class DashboardLayoutRepository extends SolidBaseRepository<DashboardLayout> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(DashboardLayout, dataSource, requestContextService, securityRuleRepository);
    }
}