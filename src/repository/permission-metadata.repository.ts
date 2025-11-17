import { Injectable } from '@nestjs/common';
import { PermissionMetadata } from 'src';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class PermissionMetadataRepository extends SolidBaseRepository<PermissionMetadata> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(PermissionMetadata, dataSource, requestContextService, securityRuleRepository);
    }
}