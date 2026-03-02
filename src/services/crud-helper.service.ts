import { Brackets, SelectQueryBuilder, WhereExpressionBuilder } from "typeorm";
import { BasicFilterDto } from "../dtos/basic-filters.dto";
import { classify } from "@angular-devkit/core/src/utils/strings";
import { ActiveUserData } from "src/interfaces/active-user-data.interface";
import { SolidRegistry } from "src/helpers/solid-registry";
import { BadRequestException, Logger } from "@nestjs/common";
import { ERROR_MESSAGES } from "src/constants/error-messages";

export enum FilterCombinator {
    AND = '$and',
    OR = '$or'
}

export enum UserIdFields {
    CREATED_BY = 'createdBy',
    UPDATED_BY = 'updatedBy'
}

export class CrudHelperService {
    constructor(
    ) { }
    private readonly logger = new Logger(CrudHelperService.name);

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
        const normalizedFilters = this.normalizeObjectKeys(filters);
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
                const normalizedPrimaryFilterObj = this.normalizeObjectKeys(primaryFilterObj);

                const [rawField, funcAlias] = key.split(':');

                // Get the operator or field from the key
                const operatorOrField = Object.keys(normalizedPrimaryFilterObj)[0];
                // if the key is an operator, then build the query based on the operator
                if (operatorOrField.startsWith('$')) {
                    const operator = operatorOrField;
                    let columnExpression: string | undefined;
                    if (funcAlias) {
                        try {
                            columnExpression = this.buildDateGranularityExpression(this.getDriver(selectQb), `${alias}.${rawField}`, funcAlias);
                        } catch {
                            throw new BadRequestException(`Unsupported field function '${funcAlias}'. Supported functions are: day, week, month, year.`);
                        }
                    }
                    this.buildOperatorQuery(qb, alias, rawField, normalizedPrimaryFilterObj, operator, columnExpression);
                    return;
                }
                else { // Recursively call the applyFilters method to handle nested conditions
                    if (funcAlias) {
                        throw new BadRequestException(`Function alias ':${funcAlias}' is not valid on relation field '${rawField}'. It can only be applied to scalar fields.`);
                    }
                    const joinField = `${alias}.${rawField}`;
                    if (!this.isRelationJoined(selectQb, joinField)) selectQb.leftJoin(joinField, rawField);
                    this.applyFilters(qb, primaryFilterObj, rawField, selectQb);
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
            case '$eqi':
                qb.andWhere(`LOWER(${colExpr}) = :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$eqi.toLowerCase() });
                break;
            case '$ne':
                qb.andWhere(`${colExpr} != :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$ne });
                break;
            case '$nei':
                qb.andWhere(`LOWER(${colExpr}) != :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$nei.toLowerCase() });
                break;
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
            case '$containsi':
                qb.andWhere(`LOWER(${colExpr}) LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$containsi.toLowerCase()}%` });
                break;
            case '$notContainsi':
                qb.andWhere(`LOWER(${colExpr}) NOT LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$notContainsi.toLowerCase()}%` });
                break;
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
            case '$startsWithi':
                qb.andWhere(`LOWER(${colExpr}) LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `${normalizedPrimaryOperatorObj.$startsWithi.toLowerCase()}%` });
                break;
            case '$endsWith':
                qb.andWhere(`${colExpr} LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$endsWith}` });
                break;
            case '$endsWithi':
                qb.andWhere(`LOWER(${colExpr}) LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$endsWithi.toLowerCase()}` });
                break;
            default:
                throw new Error(`Operator ${operator} is not supported`);
        }
    }

    // Normalize the primary operator object by removing the surrounding brackets in the keys e.g [$eq] => $eq
    private normalizeObjectKeys(obj: any): any {
        return Object.keys(obj).reduce((acc, key) => {
            // Transform the key by removing surrounding brackets
            const newKey = key.replace(/^\[(.*)\]$/, '$1');
            // Assign the value to the transformed key in the accumulator object
            acc[newKey] = obj[key];
            return acc;
        }, {});
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
        const { fields, sort, populate = [], populateMedia = [], locale, status } = basicFilterDto;

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

        let finalLocale = locale
        if (internationalisation) {
            // If locale is not provided in the filter dto, then assume it is the default locale to be used. 
            if (!finalLocale) {
                //Get default locale from registry
                const solidRegistry = moduleRef.get(SolidRegistry, { strict: false });
                const defaultLocale = solidRegistry.getDefaultLocale();
                if(defaultLocale){
                    finalLocale = defaultLocale.locale;
                }else{
                    finalLocale = 'en';
                }
            }
            qb.andWhere(`${entityAlias}.localeName = :locale`, { locale: finalLocale });
        }

        if (draftPublishWorkflow && status) {
            if (basicFilterDto.status === 'published') {
                qb.andWhere(`${entityAlias}.publishedAt IS NOT NULL`);
            } else if (basicFilterDto.status === 'draft') {
                qb.andWhere(`${entityAlias}.publishedAt IS NULL`);
            }
        }
        // Depending upon the select option, apply the select clause
        if (normalizedFields && normalizedFields.length) {
            qb.select(normalizedFields.map(field => {
                // If the field contains a (, do not prefix the entity alias
                return this.wrapFieldWithAlias(field, entityAlias);
            }));
        }

        // Depending upon the order option, apply the order by clause
        if (applySorting && normalizedSort && normalizedSort.length) {
            const orderOptions = this.orderOptions(normalizedSort);
            if (orderOptions) {
                const orderOptionKeys = Object.keys(orderOptions) as Array<keyof typeof orderOptions>;
                orderOptionKeys.forEach((key) => {
                    const value = orderOptions[key] as 'ASC' | 'DESC';
                    qb.addOrderBy(`${entityAlias}.${key}`, value);
                });
            }
        }


        if (showSoftDeleted === 'inclusive') {
            qb.withDeleted();
        }

        if (showSoftDeleted === 'exclusive') {
            qb.withDeleted();
            qb.where(`${entityAlias}.deletedAt IS NOT NULL`);
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
        const mainAlias =
            qb.expressionMap?.mainAlias?.name ||
            qb.expressionMap?.aliases?.find(a => a.metadata)?.name ||
            qb.expressionMap?.aliases?.[0]?.name;
        let parentAlias = mainAlias || rootAlias;
        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            const joinProperty = `${parentAlias}.${part}`;
            const existingAlias = this.getExistingJoinAlias(qb, joinProperty);
            const joinAlias = existingAlias ?? this.sanitizeAlias(`${parentAlias}_${part}`);
            if (!existingAlias && !this.isRelationJoined(qb, joinProperty) && !this.isAliasJoined(qb, joinAlias)) {
                qb.leftJoin(joinProperty, joinAlias);
            }
            parentAlias = joinAlias;
        }
        return { alias: parentAlias, property: pathParts[pathParts.length - 1] };
    }

    private getDriver(qb: SelectQueryBuilder<any>) {
        return qb.connection.options.type as string;
    }

    private buildDateGranularityExpression(driver: string, columnExpr: string, granularity: string) {
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
                const resolvedKey = aliasMap[key] || key as string;
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
        let parentAlias = entityAlias;
        relationParts.forEach((part, i) => {
            const joinProperty = `${parentAlias}.${part}`;
            // Check if the relation is already joined, if not then join it
            if (!this.isRelationJoined(qb, joinProperty)) {
                const joinAlias = relationParts.slice(0, i + 1).join('_');
                qb.leftJoinAndSelect(joinProperty, joinAlias);
            }
            else {
                // Since in populate, we are create a unique alias based on the relation path
                //If the join is already present, it is probably because of the relation being passed in the where filter i.e applyFilters method
                qb.addSelect(`${part}`);
            }
            parentAlias = part; // Update the parent alias for the next iteration
        });
        return qb;
    }

    private wrapFieldWithAlias(field: string, entityAlias: string): string {
        if (!this.isAggregateField(field)) return `${entityAlias}.${field}`;
        // For aggregate fields, extract the field name from the aggregate function & wrap it with the entity alias, if it is not already wrapped
        const fieldParts = field.split('(');
        const aggregateFunction = fieldParts[0];
        const fieldName = fieldParts[1].replace(')', '');
        return `${aggregateFunction}(${entityAlias}.${fieldName})`;
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
        const defaultFormats: Record<string, string> = {
            day: 'YYYY-MM-DD',
            week: 'YYYY-MM-DD',
            month: 'YYYY-MM',
            year: 'YYYY',
        };
        return this.formatGroupValue(value, defaultFormats[granularity]);
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



}
