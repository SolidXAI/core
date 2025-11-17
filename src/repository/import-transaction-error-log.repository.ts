import { Injectable } from '@nestjs/common';
import { ImportTransactionErrorLog } from 'src';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class ImportTransactionErrorLogRepository extends SolidBaseRepository<ImportTransactionErrorLog> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ImportTransactionErrorLog, dataSource, requestContextService, securityRuleRepository);
    }
}