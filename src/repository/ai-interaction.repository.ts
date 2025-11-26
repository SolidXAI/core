import { Injectable } from '@nestjs/common';
import { AiInteraction } from 'src/entities/ai-interaction.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class AiInteractionRepository extends SolidBaseRepository<AiInteraction> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(AiInteraction, dataSource, requestContextService, securityRuleRepository);
    }
}