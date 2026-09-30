import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { AgenthubSessionCheckpoint } from '../entities/agenthub-session-checkpoint.entity';

@Injectable()
export class AgenthubSessionCheckpointRepository extends SolidBaseRepository<AgenthubSessionCheckpoint> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(AgenthubSessionCheckpoint, dataSource, requestContextService, securityRuleRepository);
    }
}