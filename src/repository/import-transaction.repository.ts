import { Injectable } from '@nestjs/common';
import { ImportTransaction } from 'src';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class ImportTransactionRepository extends SolidBaseRepository<ImportTransaction> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ImportTransaction, dataSource, requestContextService, securityRuleRepository);
    }
}