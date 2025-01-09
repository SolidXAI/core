import { SelectQueryBuilder } from "typeorm";
import { BasicFilterDto } from "../dtos/basic-filters.dto";
export declare class CrudHelperService {
    constructor();
    private orderOptions;
    private applyFilters;
    private buildOperatorQuery;
    private normalizeObjectKeys;
    private normalize;
    private isRelationJoined;
    buildFilterQuery(qb: SelectQueryBuilder<any>, basicFilterDto: BasicFilterDto, entityAlias: string): SelectQueryBuilder<any>;
    isAggregateField(field: string): boolean;
    isAggregateFieldKey(key: string, alias: string): boolean;
    getFieldFromQueryFieldKey(queryFieldKey: string, alias: string): string;
    buildGroupByRecordsQuery(qb: SelectQueryBuilder<any>, group: any, alias: string): SelectQueryBuilder<any>;
    getGroupName(group: any, alias: string): string;
    createGroupRecords(group: any, alias: string, groupData: any[]): {
        groupName: string;
        groupData: any[];
    };
    createGroupMeta(group: any, alias: string): {
        groupName: string;
    };
}
