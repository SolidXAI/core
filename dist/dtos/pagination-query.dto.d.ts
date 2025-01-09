export declare class PaginationQueryDto {
    constructor(limit: number, offset: number);
    limit?: number;
    offset?: number;
    filters?: Record<string, any>;
}
