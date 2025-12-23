import { Injectable } from '@nestjs/common';
import { ModelSequence } from 'src/entities/model-sequence.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class ModelSequenceRepository extends SolidBaseRepository<ModelSequence> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ModelSequence, dataSource, requestContextService, securityRuleRepository);
    }
}