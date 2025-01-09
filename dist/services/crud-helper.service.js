"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrudHelperService = void 0;
const typeorm_1 = require("typeorm");
class CrudHelperService {
    constructor() { }
    orderOptions(sort = []) {
        const orderOptions = {};
        sort.forEach((s) => {
            const [field, order] = s.split(':');
            orderOptions[field] = order?.toUpperCase() ?? 'ASC';
            if (!['ASC', 'DESC'].includes(orderOptions[field])) {
                throw new Error(`Invalid sort order provided:  ${order}`);
            }
        });
        return orderOptions;
    }
    applyFilters(qb, filters, alias = 'entity', selectQb) {
        const normalizedFilters = this.normalizeObjectKeys(filters);
        if (normalizedFilters.$and) {
            normalizedFilters.$and.forEach((andFilter) => {
                qb.andWhere(new typeorm_1.Brackets(subQb => {
                    this.applyFilters(subQb, andFilter, alias, selectQb);
                }));
            });
        }
        else if (normalizedFilters.$or) {
            normalizedFilters.$or.forEach((orFilter) => {
                qb.orWhere(new typeorm_1.Brackets(subQb => {
                    this.applyFilters(subQb, orFilter, alias, selectQb);
                }));
            });
        }
        else {
            Object.keys(normalizedFilters).forEach(key => {
                const primaryFilterObj = normalizedFilters[key];
                const normalizedPrimaryFilterObj = this.normalizeObjectKeys(primaryFilterObj);
                const operatorOrField = Object.keys(normalizedPrimaryFilterObj)[0];
                if (operatorOrField.startsWith('$')) {
                    const operator = operatorOrField;
                    this.buildOperatorQuery(qb, alias, key, normalizedPrimaryFilterObj, operator);
                    return;
                }
                else {
                    selectQb.leftJoin(`${alias}.${key}`, key);
                    this.applyFilters(qb, primaryFilterObj, key, selectQb);
                }
            });
        }
    }
    buildOperatorQuery(qb, alias, field, normalizedPrimaryOperatorObj, operator) {
        const uniqueFieldAlias = `${alias}_${field}_${Math.floor(Math.random() * 1000)}`;
        switch (operator) {
            case '$eq':
                qb.andWhere(`${alias}.${field} = :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$eq });
                break;
            case '$eqi':
                qb.andWhere(`LOWER(${alias}.${field}) = :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$eqi.toLowerCase() });
                break;
            case '$ne':
                qb.andWhere(`${alias}.${field} != :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$ne });
                break;
            case '$nei':
                qb.andWhere(`LOWER(${alias}.${field}) != :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$nei.toLowerCase() });
                break;
            case '$gt':
                qb.andWhere(`${alias}.${field} > :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$gt });
                break;
            case '$gte':
                qb.andWhere(`${alias}.${field} >= :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$gte });
                break;
            case '$lt':
                qb.andWhere(`${alias}.${field} < :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$lt });
                break;
            case '$lte':
                qb.andWhere(`${alias}.${field} <= :${uniqueFieldAlias}`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$lte });
                break;
            case '$in':
                qb.andWhere(`${alias}.${field} IN (:...${uniqueFieldAlias})`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$in });
                break;
            case '$notIn':
                qb.andWhere(`${alias}.${field} NOT IN (:...${uniqueFieldAlias})`, { [uniqueFieldAlias]: normalizedPrimaryOperatorObj.$notIn });
                break;
            case '$contains':
                qb.andWhere(`${alias}.${field} LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$contains}%` });
                break;
            case '$notContains':
                qb.andWhere(`${alias}.${field} NOT LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$notContains}%` });
                break;
            case '$containsi':
                qb.andWhere(`LOWER(${alias}.${field}) LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$containsi.toLowerCase()}%` });
                break;
            case '$notContainsi':
                qb.andWhere(`LOWER(${alias}.${field}) NOT LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$notContainsi.toLowerCase()}%` });
                break;
            case '$null':
                qb.andWhere(`${alias}.${field} IS NULL`);
                break;
            case '$notNull':
                qb.andWhere(`${alias}.${field} IS NOT NULL`);
                break;
            case '$between':
                qb.andWhere(`${alias}.${field} BETWEEN :${uniqueFieldAlias}0 AND :${uniqueFieldAlias}1`, { [`${uniqueFieldAlias}0`]: normalizedPrimaryOperatorObj.$between[0], [`${uniqueFieldAlias}1`]: normalizedPrimaryOperatorObj.$between[1] });
                break;
            case '$startsWith':
                qb.andWhere(`${alias}.${field} LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `${normalizedPrimaryOperatorObj.$startsWith}%` });
                break;
            case '$startsWithi':
                qb.andWhere(`LOWER(${alias}.${field}) LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `${normalizedPrimaryOperatorObj.$startsWithi.toLowerCase()}%` });
                break;
            case '$endsWith':
                qb.andWhere(`${alias}.${field} LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$endsWith}` });
                break;
            case '$endsWithi':
                qb.andWhere(`LOWER(${alias}.${field}) LIKE :${uniqueFieldAlias}`, { [uniqueFieldAlias]: `%${normalizedPrimaryOperatorObj.$endsWithi.toLowerCase()}` });
                break;
            default:
                throw new Error(`Operator ${operator} is not supported`);
        }
    }
    normalizeObjectKeys(obj) {
        return Object.keys(obj).reduce((acc, key) => {
            const newKey = key.replace(/^\[(.*)\]$/, '$1');
            acc[newKey] = obj[key];
            return acc;
        }, {});
    }
    normalize(value) {
        if (!value)
            return [];
        return Array.isArray(value) ? value : [value];
    }
    isRelationJoined(queryBuilder, joinProperty) {
        return queryBuilder.expressionMap.joinAttributes.some(join => join.entityOrProperty === joinProperty);
    }
    buildFilterQuery(qb, basicFilterDto, entityAlias) {
        let { limit, offset, showSoftDeleted, showOnlySoftDeleted, filters } = basicFilterDto;
        const { fields, sort, groupBy, populate = [] } = basicFilterDto;
        const normalizedFields = this.normalize(fields);
        const normalizedPopulate = this.normalize(populate);
        const normalizedSort = this.normalize(sort);
        const normalizedGroupBy = this.normalize(groupBy);
        if (normalizedGroupBy.length > 1) {
            throw new Error('buildFilterQuery: Only 1 Group by field is supported currently');
        }
        if (filters) {
            qb.where(new typeorm_1.Brackets(whereQb => {
                this.applyFilters(whereQb, filters, entityAlias, qb);
            }));
        }
        if (normalizedFields && normalizedFields.length) {
            qb.select(normalizedFields.map(field => {
                return this.isAggregateField(field) ? field : `${entityAlias}.${field}`;
            }));
        }
        if (normalizedPopulate && normalizedPopulate.length) {
            normalizedPopulate.forEach((relation) => {
                const joinProperty = `${entityAlias}.${relation}`;
                if (!this.isRelationJoined(qb, joinProperty))
                    qb.leftJoinAndSelect(joinProperty, relation);
            });
        }
        if (normalizedSort && normalizedSort.length) {
            const orderOptions = this.orderOptions(normalizedSort);
            if (orderOptions) {
                const orderOptionKeys = Object.keys(orderOptions);
                orderOptionKeys.forEach((key) => {
                    const value = orderOptions[key];
                    qb.addOrderBy(`${entityAlias}.${key}`, value);
                });
            }
        }
        if (showSoftDeleted || showOnlySoftDeleted)
            qb.withDeleted();
        if (showOnlySoftDeleted) {
            qb.andWhere(`${entityAlias}.deletedAt IS NOT NULL`);
        }
        if (normalizedGroupBy && normalizedGroupBy.length) {
            normalizedGroupBy.forEach((field) => {
                qb.addGroupBy(`${entityAlias}.${field}`);
            });
        }
        if (limit)
            qb.limit(limit);
        if (offset)
            qb.offset(offset);
        return qb;
    }
    isAggregateField(field) {
        return field.includes('(');
    }
    isAggregateFieldKey(key, alias) {
        return !key.startsWith(`${alias}_`);
    }
    getFieldFromQueryFieldKey(queryFieldKey, alias) {
        return queryFieldKey.replace(`${alias}_`, '');
    }
    buildGroupByRecordsQuery(qb, group, alias) {
        qb.andWhere(new typeorm_1.Brackets(qb => {
            for (const key in group) {
                if (group.hasOwnProperty(key) && !this.isAggregateFieldKey(key, alias)) {
                    const value = group[key];
                    const field = this.getFieldFromQueryFieldKey(key, alias);
                    qb.andWhere(`${alias}.${field} = :${field}`, { [field]: value });
                }
            }
        }));
        return qb;
    }
    getGroupName(group, alias) {
        return Object.keys(group)
            .filter(key => !this.isAggregateFieldKey(key, alias))
            .map(key => group[key])
            .join('_');
    }
    createGroupRecords(group, alias, groupData) {
        const groupName = this.getGroupName(group, alias);
        return {
            groupName,
            groupData
        };
    }
    createGroupMeta(group, alias) {
        const groupName = this.getGroupName(group, alias);
        const groupAggregateValues = {};
        for (const key in group) {
            if (group.hasOwnProperty(key) && this.isAggregateFieldKey(key, alias)) {
                const value = group[key];
                groupAggregateValues[key] = value;
            }
        }
        return {
            groupName,
            ...groupAggregateValues
        };
    }
}
exports.CrudHelperService = CrudHelperService;
//# sourceMappingURL=crud-helper.service.js.map