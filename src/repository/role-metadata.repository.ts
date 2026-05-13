import { Injectable } from '@nestjs/common';
import { RoleMetadata } from '../entities/role-metadata.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class RoleMetadataRepository extends SolidBaseRepository<RoleMetadata> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(RoleMetadata, dataSource, requestContextService, securityRuleRepository);
    }
}