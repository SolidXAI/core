import { Injectable } from '@nestjs/common';
import { ModelMetadata } from 'src';
import { DataSource } from 'typeorm';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class ModelMetadataRepository extends SolidBaseRepository<ModelMetadata> {
    constructor(
        readonly dataSource: DataSource,
        // readonly requestContextService: RequestContextService,
        // readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ModelMetadata, dataSource, null, null);
    }
}