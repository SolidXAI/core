import { Injectable } from '@nestjs/common';
import { UserDeviceCredential } from 'src/entities/user-device-credential.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class UserDeviceCredentialRepository extends SolidBaseRepository<UserDeviceCredential> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(UserDeviceCredential, dataSource, requestContextService, securityRuleRepository);
    }
}
