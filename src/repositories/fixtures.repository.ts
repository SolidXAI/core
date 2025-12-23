import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from 'src/repository/security-rule.repository';
import { SolidBaseRepository } from 'src/repository/solid-base.repository' ;
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Fixtures } from '../entities/fixtures.entity';

@Injectable()
export class FixturesRepository extends SolidBaseRepository<Fixtures> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(Fixtures, dataSource, requestContextService, securityRuleRepository);
    }
}