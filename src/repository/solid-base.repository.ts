import { camelize } from '@angular-devkit/core/src/utils/strings';
import { Logger } from '@nestjs/common';
import { CommonEntity } from 'src/entities/common.entity';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { RequestContextService } from 'src/services/request-context.service';
import {
    DataSource,
    EntityNotFoundError,
    EntityTarget,
    FindOneOptions,
    FindOptionsWhere,
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
        const activeUserOrUndefined = this.requestContextService.getActiveUser();
        const qb = super.createQueryBuilder(alias, queryRunner);
        if (!activeUserOrUndefined) return qb;

        return this.securityRuleRepository.applySecurityRules(
            qb,
            this.modelSingularName(),
            activeUserOrUndefined as ActiveUserData
        );
    }

    /**
    * Security-aware findOne: applies FindOneOptions via FindOptionsUtils,
    * but builds from our security-wrapped QueryBuilder.
    */
    override async findOne(options?: FindOneOptions<T>): Promise<T | null> {
        const alias = this.modelSingularName();
        const qb = this.createQueryBuilder(alias);

        if (options) {
            // Apply all standard find options (relations, selects, order, where, etc.)
            if (options) qb.setFindOptions(options); // <- applies where, relations, select, order, etc.
        }

        return qb.getOne();
    }

    /**
     * Convenience: route findOneBy through the same path so rules apply.
     */
    override async findOneBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T | null> {
        return this.findOne({ where });
    }

    /**
     * Optional: an OrFail that still honors security rules.
     */
    override async findOneOrFail(options?: FindOneOptions<T>): Promise<T> {
        const entity = await this.findOne(options);
        if (!entity) {
            throw new EntityNotFoundError(this.metadata.target, options?.where ?? {});
        }
        return entity;
    }
}