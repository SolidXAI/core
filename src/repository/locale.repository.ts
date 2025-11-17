import { Injectable } from '@nestjs/common';
import { Locale } from 'src';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class LocaleRepository extends SolidBaseRepository<Locale> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(Locale, dataSource, requestContextService, securityRuleRepository);
    }
}