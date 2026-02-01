import { camelize } from '@angular-devkit/core/src/utils/strings';
import { Logger } from '@nestjs/common';
import { CommonEntity } from 'src/entities/common.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { RequestContextService } from 'src/services/request-context.service';
import {
    DataSource,
    EntityNotFoundError,
    EntityTarget,
    FindManyOptions,
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
        protected readonly requestContextService: RequestContextService | null,
        protected readonly securityRuleRepository: SecurityRuleRepository | null,
    ) {
        super(entity, dataSource.createEntityManager());
        this.logger = new Logger(this.constructor.name);
    }

    modelSingularName(): string {
        return camelize(this.metadata.name);
    }

    async findOneByUserKey(userKeyValue: string | number): Promise<T | null> {
        const modelSingularName = this.modelSingularName();
        const modelMetaRepo = this.manager.getRepository(ModelMetadata);
        const modelMeta = await modelMetaRepo.findOne({
            where: { singularName: modelSingularName },
            relations: { userKeyField: true },
        });

        if (!modelMeta?.userKeyField?.name) {
            throw new Error(`User key field not found for model ${modelSingularName}`);
        }

        return this.findOneBy({ [modelMeta.userKeyField.name]: userKeyValue } as FindOptionsWhere<T>);
    }

    override createQueryBuilder(alias?: string, queryRunner?: QueryRunner): SelectQueryBuilder<T> {
        throw new Error('createQueryBuilder() is disabled. Use createSecurityRuleAwareQueryBuilder instead');
    }

    async createSecurityRuleAwareQueryBuilder(alias?: string, queryRunner?: QueryRunner): Promise<SelectQueryBuilder<T>> {
        const qb = super.createQueryBuilder(alias, queryRunner);

        if (!this.securityRuleRepository) return qb;
        if (!this.requestContextService) return qb;

        const activeUserOrUndefined = this.requestContextService.getActiveUser();
        if (!activeUserOrUndefined) return qb;

        return await this.securityRuleRepository.applySecurityRules(
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
        const qb = await this.createSecurityRuleAwareQueryBuilder(alias);

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

    /**
     * Security-aware find(): builds from our secured QB and preserves all FindManyOptions
     * (where, relations, select, order, take/skip, withDeleted, etc.).
     */
    override async find(options?: FindManyOptions<T>): Promise<T[]> {
        const alias = this.modelSingularName();
        const qb = await this.createSecurityRuleAwareQueryBuilder(alias);

        if (options) {
            qb.setFindOptions(options);
        }

        return qb.getMany();
    }

    /**
     * (Optional) Security-aware findAndCount(): same as find(), plus a total count.
     * Mirrors Repository.findAndCount semantics.
     */
    override async findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
        const alias = this.modelSingularName();
        const qb = await this.createSecurityRuleAwareQueryBuilder(alias);

        if (options) {
            qb.setFindOptions(options);
        }

        return qb.getManyAndCount();
    }
}
