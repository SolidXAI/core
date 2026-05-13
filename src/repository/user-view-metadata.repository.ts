import { Injectable } from '@nestjs/common';
import { UserViewMetadata } from '../entities/user-view-metadata.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class UserViewMetadataRepository extends SolidBaseRepository<UserViewMetadata> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(UserViewMetadata, dataSource, requestContextService, securityRuleRepository);
    }
}