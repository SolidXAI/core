import { Brackets, EntityMetadata, SelectQueryBuilder, WhereExpressionBuilder } from "typeorm";
import { BasicFilterDto } from "../dtos/basic-filters.dto";
import { classify } from '../helpers/string.helper';
import { ActiveUserData } from "src/interfaces/active-user-data.interface";
import { SolidRegistry } from "src/helpers/solid-registry";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ERROR_MESSAGES } from "src/constants/error-messages";
import { buildCastToText } from "src/helpers/typeorm-db-helper";
import { DraftPublishHelperService } from "./create-draft-publish-helper.service";
import { InternationalisationHelperService } from "./internationalisation-helper.service";
import { normalizeObjectKeys } from "./object.utils";

export enum FilterCombinator {
    AND = '$and',
    OR = '$or'
}

export enum UserIdFields {
    CREATED_BY = 'createdBy',
    UPDATED_BY = 'updatedBy'
}

/** Aggregate functions permitted in the `fields` `fn(field)` syntax. */
const SUPPORTED_FIELD_FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];

/** Date granularities permitted in `groupBy` (`field:granularity`) and filter func-aliases. */
const SUPPORTED_GRANULARITIES = ['day', 'week', 'month', 'year'];

/**
 * Outcome of resolving a user-supplied dotted path against real entity metadata.
 * Every string here originates from TypeORM metadata, never from request input.
 */
export interface ResolvedFieldPath {
    /** Canonical relation property names for each hop traversed (excludes a column leaf). */
    relationSegments: string[];
    /** Canonical column property name, when the leaf is a column. */
    leafProperty?: string;
    /** True when the leaf itself is a relation (populate / nested-filter join). */
    leafIsRelation: boolean;
}

@Injectable()
export class CrudHelperService {
    private readonly logger = new Logger(CrudHelperService.name);

    constructor(
        private readonly draftPublishHelperService: DraftPublishHelperService,
        private readonly internationalisationHelperService: InternationalisationHelperService,
    ) { }

    /**
     * Resolve a user-supplied dotted path (e.g. "customer.name") against real TypeORM metadata.
     *
     * SECURITY — this is the choke point that makes the filtering vocabulary safe.
     * SQL can bind *values* as parameters but never *identifiers* (column names, aliases,
     * ORDER BY expressions), so a client-chosen field name must be allow-listed instead.
     * The caller's string is used ONLY as a lookup key; every value returned comes from
     * ColumnMetadata/RelationMetadata, so callers build SQL exclusively from strings this
     * codebase produced, never from request input.
     *
     * Throws BadRequestException on any segment that is not a real column/relation.
     */
    resolveFieldPathFromMetadata(
        rootMetadata: EntityMetadata,
        pathParts: string[],
        { allowRelationLeaf = false }: { allowRelationLeaf?: boolean } = {}
    ): ResolvedFieldPath {
        // Fail closed: without metadata we cannot prove the identifier is safe.
        if (!rootMetadata) throw new BadRequestException(`Cannot resolve field '${this.describeInvalidField(pathParts?.join('.'))}'`);
        if (!pathParts?.length || pathParts.some(part => !part)) {
            throw new BadRequestException(`Invalid field path '${this.describeInvalidField(pathParts?.join('.'))}'`);
        }

        let metadata = rootMetadata;
        const relationSegments: string[] = [];

        for (let i = 0; i < pathParts.length; i++) {
            const isLeaf = i === pathParts.length - 1;
            // `metadata` is the entity currently being walked; it advances one hop per segment.
            // These lookups key on propertyName/propertyPath (NOT database name), so they are
            // naming-strategy agnostic and resolve implicit relation FK columns correctly.
            const relation = metadata.findRelationWithPropertyPath(pathParts[i]);
            const column = metadata.findColumnWithPropertyName(pathParts[i]);

            if (!isLeaf) {
                // Interior segments must be relations so we can keep walking.
                if (!relation) {
                    throw new BadRequestException(`Invalid relation '${this.describeInvalidField(pathParts[i])}' in '${this.describeInvalidField(pathParts.join('.'))}'`);
                }
                relationSegments.push(relation.propertyName); // canonical, from metadata
                // THE HOP: advance to the entity on the other side so the NEXT iteration validates
                // against that entity rather than the root. Consumed at the top of the next pass —
                // it only looks unused here because `continue` follows immediately.
                // e.g. "shop.customer.mcc": NbfTransaction -> CustomerLocation -> Customer.
                // Without this, "customer" would be checked on NbfTransaction (wrongly accepted)
                // and "mcc" on NbfTransaction (wrongly rejected).
                metadata = relation.inverseEntityMetadata;
                continue;
            }

            // Leaf ordering matters: a many-to-one name can match BOTH a relation and its FK column.
            // populate (allowRelationLeaf) must treat it as a relation so it can be joined;
            // sort/filter must treat it as a column so it compares on the FK, as today.
            if (allowRelationLeaf && relation) {
                relationSegments.push(relation.propertyName);
                return { relationSegments, leafIsRelation: true };
            }
            if (column) {
                return { relationSegments, leafProperty: column.propertyName, leafIsRelation: false };
            }
            throw new BadRequestException(`Invalid field '${this.describeInvalidField(pathParts[i])}' in '${this.describeInvalidField(pathParts.join('.'))}'`);
        }

        throw new BadRequestException(`Invalid field path '${this.describeInvalidField(pathParts.join('.'))}'`);
    }

    /**
     * Query-builder flavoured wrapper around {@link resolveFieldPathFromMetadata}.
     *
     * `startAlias` matters for nested filters: applyFilters recurses into joined relations
     * carrying that relation's alias, so the leaf must resolve against the joined entity
     * rather than always the root.
     */
    resolveFieldPath(
        qb: SelectQueryBuilder<any>,
        pathParts: string[],
        { allowRelationLeaf = false, startAlias }: { allowRelationLeaf?: boolean; startAlias?: string } = {}
    ): ResolvedFieldPath {
        const aliasMetadata = startAlias ? this.findAliasMetadata(qb, startAlias) : undefined;
        const rootMetadata = aliasMetadata ?? qb?.expressionMap?.mainAlias?.metadata;
        return this.resolveFieldPathFromMetadata(rootMetadata, pathParts, { allowRelationLeaf });
    }

    private findAliasMetadata(qb: SelectQueryBuilder<any>, alias: string): EntityMetadata | undefined {
        const found = qb?.expressionMap?.aliases?.find(a => a.name === alias);
        return found?.hasMetadata ? found.metadata : undefined;
    }

    /**
     * Echo a rejected identifier back in a bounded way.
     *
     * Naming the bad field is what makes a 400 actionable for a legitimate typo, but reflecting an
     * unbounded attacker-supplied string is needless: it hands an attacker a reliable echo channel
     * and bloats logs. 80 characters is ample for a real field name.
     */
    private describeInvalidField(value: string): string {
        const text = String(value ?? '');
        return text.length > 80 ? `${text.slice(0, 80)}...` : text;
    }

    private orderOptions(sort: any[] = []) {
        const orderOptions = {};
        sort.forEach((s: string) => {
            const parts = s.split(':');
            let order: string | undefined;
            let field: string;
            if (parts.length > 1) {
                order = parts.pop();
                field = parts.join(':');
            } else {
                field = parts[0];
            }
            const normalizedOrder = order ? order.toUpperCase() : 'ASC';
            if (!['ASC', 'DESC'].includes(normalizedOrder)) {
                throw new Error(`Invalid sort order provided:  ${order}`);
            }
            orderOptions[field] = normalizedOrder;
        });
        return orderOptions;
    }

    applyFilters(qb: WhereExpressionBuilder, filters: any, alias: string = 'entity', selectQb: SelectQueryBuilder<any>) {
        const normalizedFilters = normalizeObjectKeys(filters);
        if (normalizedFilters.$and) {
            normalizedFilters.$and.forEach((andFilter: any) => {
                qb.andWhere(
                    new Brackets(subQb => {
                        this.applyFilters(subQb, andFilter, alias, selectQb);
                    })
                );
            });
        } else if (normalizedFilters.$or) {
            normalizedFilters.$or.forEach((orFilter: any) => {
                qb.orWhere(new Brackets(subQb => {
                    this.applyFilters(subQb, orFilter, alias, selectQb);
                }));
            });
        } else {
            // For individual conditions
            Object.keys(normalizedFilters).forEach(key => {
                const primaryFilterObj = normalizedFilters[key];
                const normalizedPrimaryFilterObj = normalizeObjectKeys(primaryFilterObj);

                const [rawField, funcAlias] = key.split(':');

                // Get the operator or field from the key
                const operatorOrField = Object.keys(normalizedPrimaryFilterObj)[0];
                // if the key is an operator, then build the query based on the operator
                if (operatorOrField.startsWith('$')) {
                    const operator = operatorOrField;
                    // SECURITY: resolve against the CURRENT alias (this method recurses into joined
                    // relations), so a nested filter key is checked on the joined entity rather than
                    // the root. Resolution is driven off `selectQb` because `qb` is a
                    // WhereExpressionBuilder and exposes no expressionMap.
                    const { leafProperty } = this.resolveFieldPath(selectQb, [rawField], { startAlias: alias });
                    let columnExpression: string | undefined;
                    if (funcAlias) {
                        try {
                            columnExpression = this.buildDateGranularityExpression(this.getDriver(selectQb), `${alias}.${leafProperty}`, funcAlias);
                        } catch (error) {
                            // Surface the precise granularity message; keep the original fallback
                            // for driver-level failures.
                            if (error instanceof BadRequestException) throw error;
                            throw new BadRequestException(`Unsupported field function '${this.describeInvalidField(funcAlias)}'. Supported functions are: ${SUPPORTED_GRANULARITIES.join(', ')}.`);
                        }
                    }
                    this.buildOperatorQuery(qb, alias, leafProperty, normalizedPrimaryFilterObj, operator, columnExpression);
                    return;
                }
                else { // Recursively call the applyFilters method to handle nested conditions
                    if (funcAlias) {
                        throw new BadRequestException(`Function alias ':${funcAlias}' is not valid on relation field '${rawField}'. It can only be applied to scalar fields.`);
                    }
                    // SECURITY: the nested key must be a real relation on the current entity.
                    const resolvedRelation = this.resolveFieldPath(selectQb, [rawField], { allowRelationLeaf: true, startAlias: alias });
                    if (!resolvedRelation.leafIsRelation) {
                        throw new BadRequestException(`'${this.describeInvalidField(rawField)}' is not a relation and cannot contain nested filters.`);
                    }
                    const relationName = resolvedRelation.relationSegments[resolvedRelation.relationSegments.length - 1];
                    const joinField = `${alias}.${relationName}`;
                    if (!this.isRelationJoined(selectQb, joinField)) selectQb.leftJoin(joinField, relationName);
                    this.applyFilters(qb, primaryFilterObj, relationName, selectQb);
                }
            });
        }
    }

    private buildOperatorQuery(qb: any, alias: string, field: string, normalizedPrimaryOperatorObj: any, operator: string, columnExpression?: string) {
        const uniqueFieldAlias = `${alias}_${field}_${Math.floor(Math.random() * 1000)}`;
        const colExpr = columnExpression ?? `${alias}.${field}`;
        switch (operator) {
            case '$eq':
                qb.andWhere(`${colExpr} = :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$eq });
                break;
            case '$eqi': {
                const castExpr = buildCastToText(this.getDriver(qb), colExpr);
                qb.andWhere(`LOWER(${castExpr}) = :${uniqueFieldAlias}`, { [uniqueFieldAlias]: String(normalizedPrimaryOperatorObj.$eqi).toLowerCase() });
                break;
            }
            case '$ne':
                qb.andWhere(`${colExpr} != :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$ne });
                break;
            case '$nei': {
                const castExpr = buildCastToText(this.getDriver(qb), colExpr);
                qb.andWhere(`LOWER(${castExpr}) != :${uniqueFieldAlias}`, { [uniqueFieldAlias]: String(normalizedPrimaryOperatorObj.$nei).toLowerCase() });
                break;
            }
            case '$gt':
                qb.andWhere(`${colExpr} > :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$gt });
                break;
            case '$gte':
                qb.andWhere(`${colExpr} >= :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$gte });
                break;
            case '$lt':
                qb.andWhere(`${colExpr} < :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$lt });
                break;
            case '$lte':
                qb.andWhere(`${colExpr} <= :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$lte });
                break;
            case '$in':
                qb.andWhere(`${colExpr} IN (:...${uniqueFieldAlias})`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$in });
                break;
            case '$notIn':
                qb.andWhere(`${colExpr} NOT IN (:...${uniqueFieldAlias})`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$notIn });
                break;
            case '$contains':
                qb.andWhere(`${colExpr} LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$contains}%` });
                break;
            case '$notContains':
                qb.andWhere(`${colExpr} NOT LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$notContains}%` });
                break;
            case '$containsi': {
                const castExpr = buildCastToText(this.getDriver(qb), colExpr);
                qb.andWhere(`LOWER(${castExpr}) LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${String(normalizedPrimaryOperatorObj.$containsi).toLowerCase()}%` });
                break;
            }
            case '$notContainsi': {
                const castExpr = buildCastToText(this.getDriver(qb), colExpr);
                qb.andWhere(`LOWER(${castExpr}) NOT LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${String(normalizedPrimaryOperatorObj.$notContainsi).toLowerCase()}%` });
                break;
            }
            case '$null':
                qb.andWhere(`${colExpr} IS NULL`);
                break;
            case '$notNull':
                qb.andWhere(`${colExpr} IS NOT NULL`);
                break;
            case '$between':
                qb.andWhere(`${colExpr} BETWEEN :${uniqueFieldAlias}0 AND :${uniqueFieldAlias}1`, { [`${uniqueFieldAlias}0`]: normalizedPrimaryOperatorObj.$between[0], [`${uniqueFieldAlias}1`]: normalizedPrimaryOperatorObj.$between[1] });
                break;
            case '$startsWith':
                qb.andWhere(`${colExpr} LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `${normalizedPrimaryOperatorObj.$startsWith}%` });
                break;
            case '$startsWithi': {
                const castExpr = buildCastToText(this.getDriver(qb), colExpr);
                qb.andWhere(`LOWER(${castExpr}) LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `${String(normalizedPrimaryOperatorObj.$startsWithi).toLowerCase()}%` });
                break;
            }
            case '$endsWith':
                qb.andWhere(`${colExpr} LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$endsWith}` });
                break;
            case '$endsWithi': {
                const castExpr = buildCastToText(this.getDriver(qb), colExpr);
                qb.andWhere(`LOWER(${castExpr}) LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${String(normalizedPrimaryOperatorObj.$endsWithi).toLowerCase()}` });
                break;
            }
            default:
                throw new Error(`Operator ${operator} is not supported`);
        }
    }

    normalize(value: string | string[]): string[] {
        if (!value) return []; // if the value is nullish, then return an empty array
        return Array.isArray(value) ? value : [value];        // if the value is an array, return it as is, otherwise return it as an array
    }

    private normalizeAndFilterPopulateAttributes(value: string | string[]): string[] {
        // Normalize and remove the userId fields from the populate filter, since they are handled separately
        const normalized = this.normalize(value);
        return normalized.filter(item => item !== UserIdFields.CREATED_BY && item !== UserIdFields.UPDATED_BY);
    }

    extractUserIdFieldsFromPopulate(value: string | string[]): UserIdFields[] {
        const normalized = this.normalize(value);
        return normalized.filter(item => item === UserIdFields.CREATED_BY || item === UserIdFields.UPDATED_BY);
    }

    private isRelationJoined(queryBuilder: SelectQueryBuilder<any>, joinProperty: string): boolean {
        return queryBuilder.expressionMap.joinAttributes.some(join => join.entityOrProperty === joinProperty);
    }

    private hasJoins(queryBuilder: SelectQueryBuilder<any>): boolean {
        return queryBuilder.expressionMap.joinAttributes.length > 0;
    }

    buildFilterQuery(
        qb: SelectQueryBuilder<any>,
        basicFilterDto: BasicFilterDto,
        entityAlias: string,
        internationalisation?: boolean,
        draftPublishWorkflow?: boolean,
        moduleRef?: any,
        filterCombinator: FilterCombinator = FilterCombinator.AND,
        applyPagination: boolean = true,
        applySorting: boolean = true
    ): SelectQueryBuilder<any> { // TODO : Check how to pass a type to SelectQueryBuilder instead of any
        let { limit, offset, showSoftDeleted, filters } = basicFilterDto;
        const { fields, sort, populate = [], populateMedia = [], locale } = basicFilterDto;

        // Normalize the fields, sort, groupBy and populate options i.e (since they can be either a string or an array of strings, when coming from the request)
        const normalizedFields = this.normalize(fields);
        const normalizedAndFilteredPopulateAttributes = this.normalizeAndFilterPopulateAttributes(populate);
        const normalizedPopulateMedia = this.normalize(populateMedia);

        // if normalizedPopulateMedia, has any nested media paths, then add then to populate excluding the last part
        const additionalPopulate = this.additionalRelationsRequiredForMediaPopulation(normalizedPopulateMedia);
        // Add the additional populate relations to the normalizedPopulate, if they are not already present
        normalizedAndFilteredPopulateAttributes.push(...additionalPopulate.filter((relation) => !normalizedAndFilteredPopulateAttributes.includes(relation)));

        const normalizedSort = this.normalize(sort);

        // Depending upon the populate option, apply the join clause
        if (normalizedAndFilteredPopulateAttributes && normalizedAndFilteredPopulateAttributes.length) {
            this.buildPopulateQuery(normalizedAndFilteredPopulateAttributes, entityAlias, qb);
        }

        if (filters) {
            if (filterCombinator === FilterCombinator.AND) {
                qb.andWhere(new Brackets(whereQb => {
                    this.applyFilters(whereQb, filters, entityAlias, qb);
                }));
            } else if (filterCombinator === FilterCombinator.OR) {
                qb.orWhere(new Brackets(whereQb => {
                    this.applyFilters(whereQb, filters, entityAlias, qb);
                }));
            }
        }

        if (internationalisation) {
            // If locale is not provided in the filter dto, then assume it is the default locale to be used.
            const finalLocale = locale || this.internationalisationHelperService.resolveDefaultLocaleName(moduleRef.get(SolidRegistry, { strict: false }));
            qb.andWhere(`${entityAlias}.localeName = :locale`, { locale: finalLocale });
        }

        if (draftPublishWorkflow) {
            this.draftPublishHelperService.applyDraftPublishFilterDefaults(qb, filters, entityAlias);
        }
        // Depending upon the select option, apply the select clause
        if (normalizedFields && normalizedFields.length) {
            qb.select(normalizedFields.map(field => {
                // If the field contains a (, do not prefix the entity alias
                return this.wrapFieldWithAlias(qb, field, entityAlias);
            }));
        }

        // Depending upon the order option, apply the order by clause
        if (applySorting && normalizedSort && normalizedSort.length) {
            const orderOptions = this.orderOptions(normalizedSort);
            if (orderOptions) {
                const orderOptionKeys = Object.keys(orderOptions) as Array<keyof typeof orderOptions>;
                let hasExplicitIdSort = false;
                orderOptionKeys.forEach((key) => {
                    const value = orderOptions[key] as 'ASC' | 'DESC';
                    const field = String(key);
                    if (field === 'id') {
                        hasExplicitIdSort = true;
                    }
                    if (field.includes('.')) {
                        const { alias, property, created } = this.ensureRelationPathJoined(qb, entityAlias, field.split('.'));
                        const orderColumn = `${alias}.${property}`;
                        qb.addOrderBy(orderColumn, value);
                        if (created) qb.addSelect(orderColumn);
                    } else {
                        // SECURITY: resolve against real metadata and order by the canonical column
                        // name, never the raw input (addOrderBy accepts arbitrary SQL text).
                        const { leafProperty } = this.resolveFieldPath(qb, [field]);
                        qb.addOrderBy(`${entityAlias}.${leafProperty}`, value);
                    }
                });
                if (!hasExplicitIdSort) {
                    qb.addOrderBy(`${entityAlias}.id`, 'DESC');
                }
            }
        }

        if (showSoftDeleted === 'inclusive') {
            qb.withDeleted();
        }

        if (showSoftDeleted === 'exclusive') {
            qb.withDeleted();
            // SECURITY: must be andWhere. `where()` REPLACES every previously registered condition,
            // which discarded the user's filters, the locale/status predicates and — critically —
            // the row-level security rules applied by createSecurityRuleAwareQueryBuilder.
            qb.andWhere(`${entityAlias}.deletedAt IS NOT NULL`);
        }

        // Apply the pagination options & handle the case when the query has joins
        if (applyPagination) {
            if (limit) this.hasJoins(qb) ? qb.take(limit) : qb.limit(limit);
            if (offset) this.hasJoins(qb) ? qb.skip(offset) : qb.offset(offset);
        }
        return qb;
    }

    additionalRelationsRequiredForMediaPopulation(normalizedPopulateMedia: string[]) {
        // Populate relations containing the media field
        return normalizedPopulateMedia
            .filter(pm => pm.includes("."))
            .map((pm) => {
                const mediaPathParts = pm.split('.');
                if (mediaPathParts.length <= 1) return pm;
                return mediaPathParts.slice(0, -1).join('.');
            });
    }

    private buildPopulateQuery(normalizedPopulate: string[], entityAlias: string, qb: SelectQueryBuilder<any>) {
        normalizedPopulate.forEach((relation) => {
            this.buildJoinQueryForRelation(qb, entityAlias, relation);
        });
        return qb;
    }

    private sanitizeAlias(alias: string) {
        return alias.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    private isAliasJoined(queryBuilder: SelectQueryBuilder<any>, alias: string): boolean {
        return queryBuilder.expressionMap.joinAttributes.some(join => join.alias?.name === alias);
    }

    private getExistingJoinAlias(qb: SelectQueryBuilder<any>, joinProperty: string): string | undefined {
        const existingJoin = qb.expressionMap.joinAttributes.find(join => join.entityOrProperty === joinProperty);
        return existingJoin?.alias?.name;
    }

    private ensureRelationPathJoined(qb: SelectQueryBuilder<any>, rootAlias: string, pathParts: string[]) {
        // SECURITY: validate the whole path against real metadata before any segment reaches SQL,
        // and build from the canonical names returned rather than the caller's strings. Covers
        // dotted `sort`, `groupBy` and `aggregates`, which all route through here.
        const resolved = this.resolveFieldPath(qb, pathParts);
        const mainAlias =
            qb.expressionMap?.mainAlias?.name ||
            qb.expressionMap?.aliases?.find(a => a.metadata)?.name ||
            qb.expressionMap?.aliases?.[0]?.name;
        let parentAlias = mainAlias || rootAlias;
        let leafJoinCreated = false;
        for (let i = 0; i < resolved.relationSegments.length; i++) {
            const part = resolved.relationSegments[i];
            const joinProperty = `${parentAlias}.${part}`;
            const existingAlias = this.getExistingJoinAlias(qb, joinProperty);
            const joinAlias = existingAlias ?? this.sanitizeAlias(`${parentAlias}_${part}`);
            if (!existingAlias && !this.isRelationJoined(qb, joinProperty) && !this.isAliasJoined(qb, joinAlias)) {
                qb.leftJoin(joinProperty, joinAlias);
                leafJoinCreated = true;
            } else {
                leafJoinCreated = false;
            }
            parentAlias = joinAlias;
        }
        return { alias: parentAlias, property: resolved.leafProperty, created: leafJoinCreated };
    }

    private getDriver(qb: SelectQueryBuilder<any>) {
        return qb.connection.options.type as string;
    }

    private buildDateGranularityExpression(driver: string, columnExpr: string, granularity: string) {
        // SECURITY: `granularity` is caller-supplied (groupBy `field:granularity`, or a filter
        // func-alias) and is interpolated into a quoted SQL string literal in the postgres branch
        // below. Validate it for EVERY driver here rather than per-driver: the whitelist used to be
        // duplicated inside the mysql/mssql switches and simply absent for postgres, which is
        // exactly how a quote break-out (`x'||(SELECT version())||'`) slipped through.
        if (!SUPPORTED_GRANULARITIES.includes(granularity)) {
            throw new BadRequestException(
                `Unsupported granularity '${this.describeInvalidField(granularity)}'. Supported granularities are: ${SUPPORTED_GRANULARITIES.join(', ')}.`
            );
        }
        switch (driver) {
            case 'postgres':
            case 'cockroachdb':
                return `DATE_TRUNC('${granularity}', ${columnExpr})`;
            case 'mysql':
            case 'mariadb':
                switch (granularity) {
                    case 'day': return `DATE(${columnExpr})`;
                    case 'week': return `STR_TO_DATE(DATE_FORMAT(${columnExpr}, '%x-%v-1'), '%x-%v-%w')`;
                    case 'month': return `DATE_FORMAT(${columnExpr}, '%Y-%m-01')`;
                    case 'year': return `DATE_FORMAT(${columnExpr}, '%Y-01-01')`;
                    default: throw new Error(`Unsupported granularity ${granularity} for driver ${driver}`);
                }
            case 'mssql':
            case 'sqlserver':
                switch (granularity) {
                    case 'day': return `CONVERT(date, ${columnExpr})`;
                    case 'week': return `DATEADD(week, DATEDIFF(week, 0, ${columnExpr}), 0)`;
                    case 'month': return `DATEFROMPARTS(YEAR(${columnExpr}), MONTH(${columnExpr}), 1)`;
                    case 'year': return `DATEFROMPARTS(YEAR(${columnExpr}), 1, 1)`;
                    default: throw new Error(`Unsupported granularity ${granularity} for driver ${driver}`);
                }
            default:
                throw new Error(`Granularity not supported for driver ${driver}`);
        }
    }

    private buildGroupByExpression(qb: SelectQueryBuilder<any>, rootAlias: string, field: string) {
        const parts = field.split(':');
        const rawField = parts[0];
        const granularity = parts[1];
        const format = parts[2];
        const pathParts = rawField.split('.');
        const { alias, property } = this.ensureRelationPathJoined(qb, rootAlias, pathParts);
        const columnExpr = `${alias}.${property}`;
        const groupExpr = granularity ? this.buildDateGranularityExpression(this.getDriver(qb), columnExpr, granularity) : columnExpr;
        const selectAlias = this.sanitizeAlias(`${rawField.replace(/\./g, '_')}${granularity ? '_' + granularity : ''}`);
        return { groupExpr, selectAlias, sourceKey: field, format };
    }

    applyGroupBySelections(
        qb: SelectQueryBuilder<any>,
        groupBy: string[],
        entityAlias: string
    ) {
        const aliasMap: Record<string, string> = {};
        const formatMap: Record<string, string | undefined> = {};
        const expressionMap: Record<string, string> = {};
        qb.select([]);
        groupBy.forEach((field) => {
            const { groupExpr, selectAlias, sourceKey, format } = this.buildGroupByExpression(qb, entityAlias, field);
            qb.addSelect(groupExpr, selectAlias);
            qb.addGroupBy(groupExpr);
            aliasMap[sourceKey] = selectAlias;
            formatMap[selectAlias] = format;
            expressionMap[selectAlias] = groupExpr;
        });
        return { aliasMap, formatMap, expressionMap };
    }

    private buildAggregateExpression(qb: SelectQueryBuilder<any>, rootAlias: string, aggregate: string) {
        const [rawField, rawFn] = aggregate.split(':');
        const fn = (rawFn || 'count').toLowerCase();
        if ((!rawField || rawField.toLowerCase() === 'count') && fn === 'count') {
            return { expression: 'COUNT(*)', selectAlias: 'count' };
        }
        if (!rawField) throw new Error(`Invalid aggregate specification: ${aggregate}`);
        const pathParts = rawField.split('.');
        const { alias, property } = this.ensureRelationPathJoined(qb, rootAlias, pathParts);
        const columnExpr = `${alias}.${property}`;
        const selectAlias = this.sanitizeAlias(`${rawField.replace(/\./g, '_')}_${fn}`);
        let expression = '';
        switch (fn) {
            case 'count': expression = `COUNT(${columnExpr})`; break;
            case 'count_distinct': expression = `COUNT(DISTINCT ${columnExpr})`; break;
            case 'sum': expression = `SUM(${columnExpr})`; break;
            case 'avg': expression = `AVG(${columnExpr})`; break;
            case 'min': expression = `MIN(${columnExpr})`; break;
            case 'max': expression = `MAX(${columnExpr})`; break;
            default: throw new Error(`Unsupported aggregate function ${fn}`);
        }
        return { expression, selectAlias, sourceKey: aggregate };
    }

    applyAggregates(
        qb: SelectQueryBuilder<any>,
        aggregates: string[] | undefined,
        entityAlias: string
    ) {
        const aggregateList = this.normalize(aggregates);
        const aggregateAliasMap: Record<string, string> = {};
        if (!aggregateList.length) {
            qb.addSelect('COUNT(*)', 'count');
            aggregateAliasMap['count'] = 'count';
            return aggregateAliasMap;
        }
        aggregateList.forEach((agg) => {
            const { expression, selectAlias, sourceKey } = this.buildAggregateExpression(qb, entityAlias, agg);
            qb.addSelect(expression, selectAlias);
            aggregateAliasMap[sourceKey] = selectAlias;
        });
        return aggregateAliasMap;
    }

    applyGroupSortingAndPagination(
        qb: SelectQueryBuilder<any>,
        sort: string[] | undefined,
        aliasMap: Record<string, string>,
        limit?: number,
        offset?: number
    ) {
        const normalizedSort = this.normalize(sort);
        if (normalizedSort.length) {
            const orderOptions = this.orderOptions(normalizedSort);
            const orderOptionKeys = Object.keys(orderOptions) as Array<keyof typeof orderOptions>;
            orderOptionKeys.forEach((key) => {
                // SECURITY: in a grouped query the only legally sortable names are the declared
                // group/aggregate aliases. Falling back to the raw key spliced it into a quoted
                // identifier, which an embedded double-quote could break out of.
                const resolvedKey = aliasMap[key];
                if (!resolvedKey) {
                    throw new BadRequestException(
                        `Cannot sort by '${this.describeInvalidField(String(key))}' on a grouped query. Sort only by a groupBy or aggregate field.`
                    );
                }
                const value = orderOptions[key] as 'ASC' | 'DESC';
                qb.addOrderBy(`"${resolvedKey}"`, value);
            });
        }
        const hasLimit = limit !== undefined && limit !== null;
        const hasOffset = offset !== undefined && offset !== null;

        // Use both take/skip and limit/offset to ensure pagination is applied even when joins are present.
        if (hasLimit) {
            qb.take(limit);
            qb.limit(limit);
        }
        if (hasOffset) {
            qb.skip(offset);
            qb.offset(offset);
        }
    }

    async countGroups(qb: SelectQueryBuilder<any>) {
        const clone = qb.clone();
        clone.limit(undefined).offset(undefined).take(undefined).skip(undefined);
        const rows = await clone.getRawMany();
        return rows.length;
    }

    private buildJoinQueryForRelation(qb: SelectQueryBuilder<any>, entityAlias: string, relation: string) {
        // We split the joinProperty to get the alias of the entity we are joining
        const relationParts = relation.split('.');
        // SECURITY: every segment must be a real relation on the entity being walked. The canonical
        // names returned here are what get spliced below, so no request string reaches the join.
        const { relationSegments, leafIsRelation } = this.resolveFieldPath(qb, relationParts, { allowRelationLeaf: true });
        if (!leafIsRelation) {
            throw new BadRequestException(`'${this.describeInvalidField(relation)}' is not a relation and cannot be populated.`);
        }
        let parentAlias = entityAlias;
        relationSegments.forEach((part, i) => {
            const joinProperty = `${parentAlias}.${part}`;
            // Check if the relation is already joined, if not then join it
            if (!this.isRelationJoined(qb, joinProperty)) {
                const joinAlias = this.sanitizeAlias(relationSegments.slice(0, i + 1).join('_'));
                qb.leftJoinAndSelect(joinProperty, joinAlias);
            }
            else {
                // Since in populate, we are create a unique alias based on the relation path
                //If the join is already present, it is probably because of the relation being passed in the where filter i.e applyFilters method
                qb.addSelect(`${part}`);
            }
            // NOTE: deliberately left as `part` rather than the joinAlias. That is a pre-existing
            // alias-chaining bug which breaks 3+ level populate; fixing it is tracked separately so
            // this security change stays behaviour-preserving for queries that work today.
            parentAlias = part; // Update the parent alias for the next iteration
        });
        return qb;
    }

    private wrapFieldWithAlias(qb: SelectQueryBuilder<any>, field: string, entityAlias: string): string {
        // SECURITY: `qb.select()` accepts arbitrary SQL text, so the field name must be resolved
        // against real metadata and the canonical column name spliced instead of the raw input.
        if (!this.isAggregateField(field)) {
            return `${entityAlias}.${this.resolveOwnColumn(qb, field, 'fields')}`;
        }
        // For aggregate fields, extract the field name from the aggregate function & wrap it with the entity alias, if it is not already wrapped
        const fieldParts = field.split('(');
        const aggregateFunction = fieldParts[0].trim().toUpperCase();
        // Whitelist the function name too, mirroring buildAggregateExpression.
        if (!SUPPORTED_FIELD_FUNCTIONS.includes(aggregateFunction)) {
            throw new BadRequestException(
                `Unsupported field function '${this.describeInvalidField(fieldParts[0])}'. Supported functions are: ${SUPPORTED_FIELD_FUNCTIONS.join(', ')}.`
            );
        }
        const fieldName = fieldParts[1].replace(')', '').trim();
        return `${aggregateFunction}(${entityAlias}.${this.resolveOwnColumn(qb, fieldName, 'fields')})`;
    }

    /**
     * Resolve a single-segment column on the root entity and return its canonical name.
     *
     * Related (dotted) paths are rejected rather than resolved: the caller emits
     * `<rootAlias>.<column>` and builds no joins, so resolving a dotted path here would splice the
     * leaf against the root alias and silently read the wrong column. Such paths previously
     * produced invalid SQL, so rejecting them is the honest behaviour.
     */
    private resolveOwnColumn(qb: SelectQueryBuilder<any>, field: string, context: string): string {
        const resolved = this.resolveFieldPath(qb, field.split('.'));
        if (resolved.relationSegments.length) {
            throw new BadRequestException(
                `Related field '${this.describeInvalidField(field)}' is not supported in '${context}'. Use 'populate' to fetch related records.`
            );
        }
        return resolved.leafProperty;
    }

    isAggregateField(field: string): boolean {
        return field.includes('(');
    }

    isAggregateFieldKey(key: string, aggregateAliases: Set<string>): boolean {
        return aggregateAliases.has(key);
    }

    getFieldFromQueryFieldKey(queryFieldKey: string, alias: string): string {
        return queryFieldKey.replace(`${alias}_`, '');
    }

    buildGroupByRecordsQuery(
        qb: SelectQueryBuilder<any>,
        group: any,
        alias: string,
        groupAliasMap: Record<string, string> = {},
        aggregateAliasMap: Record<string, string> = {},
        groupExpressionMap: Record<string, string> = {}
    ): SelectQueryBuilder<any> {
        const rootAlias = qb.expressionMap?.mainAlias?.name
            ?? qb.expressionMap?.aliases?.find(a => a.metadata)?.name
            ?? qb.expressionMap?.aliases?.[0]?.name
            ?? (qb as any).alias
            ?? alias;
        qb.andWhere(new Brackets(qb => {
            const aggregateAliasSet = new Set(Object.values(aggregateAliasMap));
            const reverseGroupAliasMap = Object.entries(groupAliasMap).reduce((acc, [sourceKey, aliasKey]) => {
                acc[aliasKey] = sourceKey;
                return acc;
            }, {} as Record<string, string>);
            for (const key in group) {
                if (group.hasOwnProperty(key) && !this.isAggregateFieldKey(key, aggregateAliasSet)) {
                    const value = group[key];
                    const sourceField = reverseGroupAliasMap[key] || key;
                    const cleanedField = sourceField.split(':')[0];
                    const pathParts = cleanedField.split('.');
                    const { alias: resolvedAlias, property } = this.ensureRelationPathJoined(qb as any, rootAlias, pathParts);
                    const paramKey = this.sanitizeAlias(`${resolvedAlias}_${property}_${key}`);
                    const expr = (sourceField.includes(':') && groupExpressionMap[key])
                        ? groupExpressionMap[key]
                        : `${resolvedAlias}.${property}`;
                    qb.andWhere(`${expr} = :${paramKey}`, { [paramKey]: value });
                }
            }
        }));
        return qb;
    }

    private formatGroupValue(value: any, format?: string) {
        if (!format) return value;
        if (value === null || value === undefined) return value;
        const dateVal = value instanceof Date ? value : new Date(value);
        if (isNaN(dateVal.getTime())) return value;
        switch (format) {
            case 'MMM':
                return dateVal.toLocaleString('en', { month: 'short' });
            case 'MMMM':
                return dateVal.toLocaleString('en', { month: 'long' });
            case 'YYYY':
                return dateVal.getFullYear();
            case 'YYYY-MM':
                return `${dateVal.getFullYear()}-${String(dateVal.getMonth() + 1).padStart(2, '0')}`;
            case 'YYYY-MM-DD':
                return `${dateVal.getFullYear()}-${String(dateVal.getMonth() + 1).padStart(2, '0')}-${String(dateVal.getDate()).padStart(2, '0')}`;
            default:
                return value;
        }
    }

    private getGroupFieldValues(
        group: any,
        groupByFields: string[],
        groupAliasMap: Record<string, string>
    ): Array<{ rawVal: any; alias: string; granularity?: string }> {
        return groupByFields
            .map(field => {
                const parts = field.split(':');
                const granularity = parts[1];
                const alias = groupAliasMap[field] ?? this.sanitizeAlias(field.replace(/\./g, '_'));
                const rawVal = group[alias] ?? group[field] ?? group[field.replace(/\./g, '_')];
                return { rawVal, alias, granularity };
            })
            .filter(({ rawVal }) => rawVal !== undefined && rawVal !== null);
    }

    private normalizeGroupValue(value: any, granularity?: string): any {
        if (!granularity) return value;
        return this.formatGroupValue(value, 'YYYY-MM-DD');
    }

    getGroupName(
        group: any,
        aggregateAliases: Set<string>,
        groupByFields: string[],
        groupAliasMap: Record<string, string>,
        groupFormatMap: Record<string, string | undefined>
    ): string {
        const fieldValues = this.getGroupFieldValues(group, groupByFields, groupAliasMap);

        if (fieldValues.length === 0) {
            return Object.keys(group)
                .filter(key => !this.isAggregateFieldKey(key, aggregateAliases))
                .map(key => group[key])
                .join('_');
        }

        return fieldValues
            .map(({ rawVal, alias }) => this.formatGroupValue(rawVal, groupFormatMap[alias]))
            .join('_');
    }

    getGroupValue(  
        group: any,
        groupByFields: string[],
        groupAliasMap: Record<string, string>
    ): any {
        const fieldValues = this.getGroupFieldValues(group, groupByFields, groupAliasMap);
        if (fieldValues.length === 1) return this.normalizeGroupValue(fieldValues[0].rawVal, fieldValues[0].granularity);
        return fieldValues.map(({ rawVal, granularity }) => this.normalizeGroupValue(rawVal, granularity)).join('_');
    }

    createGroupRecords(group: any, aggregateAliases: Set<string>, groupData: any, groupByFields: string[], groupAliasMap: Record<string, string>, groupFormatMap: Record<string, string | undefined>) {
        const groupName = this.getGroupName(group, aggregateAliases, groupByFields, groupAliasMap, groupFormatMap);
        return {
            groupName,
            groupData
        }
    }
    createGroupMeta(group: any, aggregateAliases: Set<string>, groupByFields: string[], groupAliasMap: Record<string, string>, groupFormatMap: Record<string, string | undefined>) {
        const groupName = this.getGroupName(group, aggregateAliases, groupByFields, groupAliasMap, groupFormatMap);
        const groupValue = this.getGroupValue(group, groupByFields, groupAliasMap);
        const groupAggregateValues = {}
        for (const key in group) {
            if (group.hasOwnProperty(key) && this.isAggregateFieldKey(key, aggregateAliases)) {
                const value = group[key];
                groupAggregateValues[key] = value;
            }
        }
        return {
            groupName,
            groupValue,
            ...groupAggregateValues
        };
    }

    async countGroupedRecords(qb: SelectQueryBuilder<any>, basicFilterDto: BasicFilterDto, entityAlias: string) { //TODO : Check how to pass a type to SelectQueryBuilder instead of any
        const { limit, offset, ...rest } = basicFilterDto;
        const filteredDto = { ...rest, limit: undefined, offset: undefined };

        const filteredQB = this.buildFilterQuery(qb, filteredDto as BasicFilterDto, entityAlias, undefined, undefined, undefined, FilterCombinator.AND, false, false);

        const groupByFields = this.normalize(filteredDto.groupBy);

        if (!groupByFields || groupByFields.length === 0) {
            throw new Error(ERROR_MESSAGES.INVALID_GROUP_BY_COUNT);
        }

        this.applyGroupBySelections(filteredQB, groupByFields, entityAlias);
        this.applyAggregates(filteredQB, ['count'], entityAlias);
        filteredQB.limit(undefined).offset(undefined).take(undefined).skip(undefined);

        const rawResults = await filteredQB.getRawMany();
        return rawResults.length;
    }

    hasReadPermissionOnModel = (activeUser: ActiveUserData, modelName: string) => {
        const permissionNames = [`${classify(modelName)}Controller.findOne`, `${classify(modelName)}Controller.findMany`];
        const matchingPermssions = activeUser.permissions.filter((p) => permissionNames.includes(p));
        return matchingPermssions.length > 0
    }

    hasWritePermissionOnModel = (activeUser: ActiveUserData, modelName: string) => {
        const permissionNames = [`${classify(modelName)}Controller.create`, `${classify(modelName)}Controller.insertMany`, `${classify(modelName)}Controller.update`];
        const matchingPermssions = activeUser.permissions.filter((p) => permissionNames.includes(p));
        return matchingPermssions.length > 0
    }

    hasUpdatePermissionOnModel = (activeUser: ActiveUserData, modelName: string) => {
        const permissionNames = [`${classify(modelName)}Controller.update`];
        const matchingPermssions = activeUser.permissions.filter((p) => permissionNames.includes(p));
        return matchingPermssions.length > 0
    }

    hasPublishPermissionOnModel = (activeUser: ActiveUserData, modelName: string) => {
        const permissionNames = [`${classify(modelName)}Controller.publish`];
        const matchingPermssions = activeUser.permissions.filter((p) => permissionNames.includes(p));
        return matchingPermssions.length > 0
    }

    hasUnpublishPermissionOnModel = (activeUser: ActiveUserData, modelName: string) => {
        const permissionNames = [`${classify(modelName)}Controller.publish`];
        const matchingPermssions = activeUser.permissions.filter((p) => permissionNames.includes(p));
        return matchingPermssions.length > 0
    }

    hasDeletePermissionOnModel = (activeUser: ActiveUserData, modelName: string) => {
        const permissionNames = [`${classify(modelName)}Controller.delete`, `${classify(modelName)}Controller.deleteMany`];
        const matchingPermssions = activeUser.permissions.filter((p) => permissionNames.includes(p));
        return matchingPermssions.length > 0
    }
    hasCreatePermissionOnModel = (activeUser: ActiveUserData, modelName: string) => {
        const permissionNames = [`${classify(modelName)}Controller.create`];
        const matchingPermssions = activeUser.permissions.filter((p) => permissionNames.includes(p));
        return matchingPermssions.length > 0
    }
    hasRecoverPermissionOnModel = (activeUser: ActiveUserData, modelName: string) => {
        const permissionNames = [`${classify(modelName)}Controller.recover`, `${classify(modelName)}Controller.recoverMany`];
        const matchingPermssions = activeUser.permissions.filter((p) => permissionNames.includes(p));
        return matchingPermssions.length > 0
    }

    pagedResponse<T>(offset: number | undefined, limit: number | undefined, count: number, entities: T[]) {
        const safeLimit = limit ?? count ?? 0;
        const safeOffset = offset ?? 0;
        const currentPage = safeLimit ? Math.floor(safeOffset / safeLimit) + 1 : 1;
        const totalPages = safeLimit ? Math.ceil(count / safeLimit) : 1;
        const nextPage = safeLimit && currentPage < totalPages ? currentPage + 1 : null;
        const prevPage = safeLimit && currentPage > 1 ? currentPage - 1 : null;
        return {
            meta: {
                totalRecords: count,
                currentPage,
                nextPage,
                prevPage,
                totalPages,
                perPage: safeLimit ? +safeLimit : 0,
            },
            records: entities,
        };
    }

    async executeGroupPipeline<T>(
        filterQb: SelectQueryBuilder<T>,
        basicFilterDto: BasicFilterDto,
        alias: string,
        createQbFn: () => Promise<SelectQueryBuilder<T>>,
        postProcessEntities?: (entities: T[]) => Promise<void>
    ): Promise<{ meta: { totalRecords: number }; groupMeta: any[]; groupRecords: any[] }> {
        const groupByFields = this.normalize(basicFilterDto.groupBy);
        if (!groupByFields.length) throw new BadRequestException(ERROR_MESSAGES.INVALID_GROUP_BY_COUNT);

        if (basicFilterDto.populateGroup) {
            const hasRelationGroup = groupByFields.some(f => f.includes('.'));
            if (hasRelationGroup) throw new BadRequestException('populateGroup is not supported when grouping on relation fields. Fetch group metadata first and retrieve records in a separate call.');
        }

        const { aliasMap: groupAliasMap, formatMap: groupFormatMap, expressionMap: groupExpressionMap } =
            this.applyGroupBySelections(filterQb, groupByFields, alias);
        const aggregateAliasMap = this.applyAggregates(filterQb, basicFilterDto.aggregates, alias);
        this.applyGroupSortingAndPagination(filterQb, basicFilterDto.sort, { ...groupAliasMap, ...aggregateAliasMap }, basicFilterDto.limit, basicFilterDto.offset);

        const groupByResult = await filterQb.getRawMany();
        const totalGroups = await this.countGroups(filterQb);
        const aggregateAliasSet = new Set(Object.values(aggregateAliasMap));

        const groupMeta = [];
        const groupRecords = [];

        for (const group of groupByResult) {
            groupMeta.push(this.createGroupMeta(group, aggregateAliasSet, groupByFields, groupAliasMap, groupFormatMap));

            if (basicFilterDto.populateGroup) {
                let groupQb = await createQbFn();
                const { groupBy: _gb, aggregates: _agg, ...rest } = basicFilterDto;
                const groupFilterDto: BasicFilterDto = {
                    ...rest,
                    ...basicFilterDto.groupFilter,
                    groupBy: undefined,
                    aggregates: undefined,
                    sort: basicFilterDto.groupFilter?.sort,
                };
                groupQb = this.buildFilterQuery(groupQb, groupFilterDto, alias);
                groupQb = this.buildGroupByRecordsQuery(groupQb, group, alias, groupAliasMap, aggregateAliasMap, groupExpressionMap);
                const [entities, count] = await groupQb.getManyAndCount();
                if (postProcessEntities) await postProcessEntities(entities);
                const groupData = this.pagedResponse(basicFilterDto.groupFilter?.offset, basicFilterDto.groupFilter?.limit, count, entities);
                groupRecords.push(this.createGroupRecords(group, aggregateAliasSet, groupData, groupByFields, groupAliasMap, groupFormatMap));
            }
        }

        return { meta: { totalRecords: totalGroups }, groupMeta, groupRecords };
    }

}
