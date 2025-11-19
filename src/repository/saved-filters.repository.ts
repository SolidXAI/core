import { Injectable } from '@nestjs/common';
import { SavedFilters } from 'src';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class SavedFiltersRepository extends SolidBaseRepository<SavedFilters> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(SavedFilters, dataSource, requestContextService, securityRuleRepository);
    }
}