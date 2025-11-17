import { Injectable } from '@nestjs/common';
import { ModelMetadata, SecurityRuleRepository } from 'src';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class ModelMetadataRepository extends SolidBaseRepository<ModelMetadata> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ModelMetadata, dataSource, requestContextService, securityRuleRepository);
    }
}