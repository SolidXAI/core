import { Injectable } from '@nestjs/common';
import { ExportTransaction } from 'src';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class ExportTransactionRepository extends SolidBaseRepository<ExportTransaction> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ExportTransaction, dataSource, requestContextService, securityRuleRepository);
    }
}