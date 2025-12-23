import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from 'src/repository/security-rule.repository';
import { SolidBaseRepository } from 'src/repository/solid-base.repository' ;
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { FixturesModels } from '../entities/fixtures-models.entity';

@Injectable()
export class FixturesModelsRepository extends SolidBaseRepository<FixturesModels> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(FixturesModels, dataSource, requestContextService, securityRuleRepository);
    }
}