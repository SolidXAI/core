import { Injectable } from '@nestjs/common';
import { MenuItemMetadata } from 'src';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class MenuItemMetadataRepository extends SolidBaseRepository<MenuItemMetadata> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(MenuItemMetadata, dataSource, requestContextService, securityRuleRepository);
    }
}