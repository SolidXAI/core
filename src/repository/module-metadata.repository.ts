import { Injectable } from '@nestjs/common';
import { ModuleMetadata } from 'src';
import { DataSource } from 'typeorm';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class ModuleMetadataRepository extends SolidBaseRepository<ModuleMetadata> {
    constructor(
        readonly dataSource: DataSource,
        // readonly requestContextService: RequestContextService,
        // readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ModuleMetadata, dataSource, null, null);
    }
}