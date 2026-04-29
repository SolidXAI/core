import { Injectable } from '@nestjs/common';
import { EmailTemplate } from '../entities/email-template.entity';
import { ExportTemplate } from '../entities/export-template.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class ExportTemplateRepository extends SolidBaseRepository<ExportTemplate> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ExportTemplate, dataSource, requestContextService, securityRuleRepository);
    }
}