import { PaginationQueryDto } from "src/dtos/pagination-query.dto";
export declare class BasicFilterDto extends PaginationQueryDto {
    readonly fields?: string[];
    readonly sort?: string[];
    readonly groupBy?: string[];
    readonly populate?: string[];
    readonly populateMedia?: string[];
    readonly showSoftDeleted?: boolean;
    readonly showOnlySoftDeleted?: boolean;
    readonly populateGroup?: boolean;
}
