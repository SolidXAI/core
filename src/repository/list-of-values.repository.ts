import { Injectable } from '@nestjs/common';
import { ListOfValues } from '../entities/list-of-values.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class ListOfValuesRepository extends SolidBaseRepository<ListOfValues> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ListOfValues, dataSource, requestContextService, securityRuleRepository);
    }
}