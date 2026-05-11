import { camelCase } from 'lodash';
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
    SelectQueryBuilder,
    UpdateResult
} from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { PickKeysByType } from 'typeorm/common/PickKeysByType';

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
        return camelCase(this.metadata.name);
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

    /**
 * Security-aware count(): applies security rules before counting.
 */
    override async count(options?: FindManyOptions<T>): Promise<number> {
        const alias = this.modelSingularName();
        const qb = await this.createSecurityRuleAwareQueryBuilder(alias);

        if (options) {
            qb.setFindOptions(options);
        }

        return qb.getCount();
    }

    /**
     * Security-aware countBy(): convenience wrapper routed through count().
     */
    override async countBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<number> {
        return this.count({ where });
    }

    /**
 * Security-aware average(): applies security rules before computing the average.
 */
    override async average(columnName: PickKeysByType<T, number>, where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<number | null> {
        const alias = this.modelSingularName();
        const qb = await this.createSecurityRuleAwareQueryBuilder(alias);

        if (where) {
            qb.setFindOptions({ where });
        }

        const result = await qb
            .select(`AVG(CAST(${alias}.${String(columnName)} AS FLOAT))`, 'avg')
            .getRawOne<{ avg: string | number | null }>();

        if (result?.avg === null || result?.avg === undefined) {
            return null;
        }

        return typeof result.avg === 'number'
            ? result.avg
            : parseFloat(result.avg);
    }

    /**
 * Security-aware sum(): applies security rules before computing the sum.
 */
    override async sum(columnName: PickKeysByType<T, number>, where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<number | null> {
        const alias = this.modelSingularName();
        const qb = await this.createSecurityRuleAwareQueryBuilder(alias);

        if (where) {
            qb.setFindOptions({ where });
        }

        const result = await qb
            .select(`SUM(CAST(${alias}.${String(columnName)} AS FLOAT))`, 'sum')
            .getRawOne<{ sum: string | number | null }>();

        if (result?.sum === null || result?.sum === undefined) {
            return null;
        }

        return typeof result.sum === 'number'
            ? result.sum
            : parseFloat(result.sum);
    }

    /**
     * Security-aware minimum(): applies security rules before computing the minimum.
     */
    override async minimum(columnName: PickKeysByType<T, number>, where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<number | null> {
        const alias = this.modelSingularName();
        const qb = await this.createSecurityRuleAwareQueryBuilder(alias);

        if (where) {
            qb.setFindOptions({ where });
        }

        const result = await qb
            .select(`MIN(CAST(${alias}.${String(columnName)} AS FLOAT))`, 'min')
            .getRawOne<{ min: string | number | null }>();

        if (result?.min === null || result?.min === undefined) {
            return null;
        }

        return typeof result.min === 'number'
            ? result.min
            : parseFloat(result.min);
    }

    /**
     * Security-aware maximum(): applies security rules before computing the maximum.
     */
    override async maximum(columnName: PickKeysByType<T, number>, where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<number | null> {
        const alias = this.modelSingularName();
        const qb = await this.createSecurityRuleAwareQueryBuilder(alias);

        if (where) {
            qb.setFindOptions({ where });
        }

        const result = await qb
            .select(`MAX(CAST(${alias}.${String(columnName)} AS FLOAT))`, 'max')
            .getRawOne<{ max: string | number | null }>();

        if (result?.max === null || result?.max === undefined) {
            return null;
        }

        return typeof result.max === 'number'
            ? result.max
            : parseFloat(result.max);
    }

    /**
     * Security-aware increment(): increments a column by a given value for all matching rows.
     * Security rules are applied to determine which rows the user is allowed to modify.
     */
    override async increment(where: FindOptionsWhere<T>, propertyPath: string, value: string | number,): Promise<UpdateResult> {
        const alias = this.modelSingularName();
        const qb = await this.createSecurityRuleAwareQueryBuilder(alias);

        qb.setFindOptions({ where });

        const rows = await qb.select(`${alias}.id`).getMany();
        const ids = rows.map((r) => (r as any).id);

        if (ids.length === 0) {
            return { raw: [], affected: 0, generatedMaps: [] };
        }

        return this.manager
            .createQueryBuilder()
            .update(this.metadata.target)
            .set({ [propertyPath]: () => `${propertyPath} + :value` } as any)
            .whereInIds(ids)
            .setParameter('value', value)
            .execute();
    }

    /**
     * Security-aware decrement(): decrements a column by a given value for all matching rows.
     * Security rules are applied to determine which rows the user is allowed to modify.
     */
    override async decrement(where: FindOptionsWhere<T>, propertyPath: string, value: string | number,): Promise<UpdateResult> {
        const alias = this.modelSingularName();
        const qb = await this.createSecurityRuleAwareQueryBuilder(alias);

        qb.setFindOptions({ where });

        const rows = await qb.select(`${alias}.id`).getMany();
        const ids = rows.map((r) => (r as any).id);

        if (ids.length === 0) {
            return { raw: [], affected: 0, generatedMaps: [] };
        }

        return this.manager
            .createQueryBuilder()
            .update(this.metadata.target)
            .set({ [propertyPath]: () => `${propertyPath} - :value` } as any)
            .whereInIds(ids)
            .setParameter('value', value)
            .execute();
    }
}
