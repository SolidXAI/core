import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from '@solidxai/core';
import { SolidBaseRepository } from '@solidxai/core' ;
import { RequestContextService } from '@solidxai/core';
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