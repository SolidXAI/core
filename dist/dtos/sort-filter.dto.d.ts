import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
export declare class SortAndFilterQueryDto extends PaginationQueryDto {
    sort?: string[];
    filters?: {
        [key: string]: any;
    };
}
