export class QueryDto {
    sort : string[];
    filters: any;
    populate: any;
    fields: string[];
    limit: number;
    offset: number;
}