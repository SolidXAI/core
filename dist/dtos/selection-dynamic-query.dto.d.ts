import { PaginationQueryDto } from "src/dtos/pagination-query.dto";
export declare class SelectionDynamicQueryDto extends PaginationQueryDto {
    constructor(fieldId: number, query: string, limit: number, offset: number);
    fieldId: number;
    query?: string;
    optionValue?: string;
}
