import { camelize } from '@angular-devkit/core/src/utils/strings';
import { Logger } from '@nestjs/common';
import { CommonEntity } from 'src/entities/common.entity';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { RequestContextService } from 'src/services/request-context.service';
import {
    DataSource,
    EntityTarget,
    QueryRunner,
    Repository,
    SelectQueryBuilder
} from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';

export class SolidBaseRepository<T extends CommonEntity> extends Repository<T> {
    protected readonly logger: Logger;

    constructor(
        entity: EntityTarget<T>,
        dataSource: DataSource,
        protected readonly requestContextService: RequestContextService,
        protected readonly securityRuleRepository: SecurityRuleRepository
    ) {
        super(entity, dataSource.createEntityManager());
        this.logger = new Logger(this.constructor.name);
    }

    modelSingularName(): string {
        return camelize(this.metadata.name);
    }

    createQueryBuilder(alias?: string, queryRunner?: QueryRunner): SelectQueryBuilder<T> {
        let activeUserOrUndefined = this.requestContextService.getActiveUser();
        const qb = super.createQueryBuilder(alias, queryRunner);
        if (!activeUserOrUndefined) {
            return qb;
        }
        return this.securityRuleRepository.applySecurityRules(
            qb,
            this.modelSingularName(),
            activeUserOrUndefined as ActiveUserData
        );
    }


}