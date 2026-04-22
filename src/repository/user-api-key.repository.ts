import { Injectable } from '@nestjs/common';
import { UserApiKey } from 'src/entities/user-api-key.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class UserApiKeyRepository extends SolidBaseRepository<UserApiKey> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(UserApiKey, dataSource, requestContextService, securityRuleRepository);
    }
}
