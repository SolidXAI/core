import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from 'src/repository/security-rule.repository';
import { SolidBaseRepository } from 'src/repository/solid-base.repository' ;
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Fixture } from '../entities/fixture.entity';

@Injectable()
export class FixtureRepository extends SolidBaseRepository<Fixture> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(Fixture, dataSource, requestContextService, securityRuleRepository);
    }
}