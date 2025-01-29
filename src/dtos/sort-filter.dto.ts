import { Type } from 'class-transformer';
import { IsOptional, IsArray, IsObject } from 'class-validator';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';

export class SortAndFilterQueryDto extends PaginationQueryDto {
    @IsOptional()
    @IsArray()
    @Type(() => String)
    sort?: string[]; // Expects strings like ["field:ASC", "field:DESC"]

    @IsOptional()
    @IsObject()
    filters?: { [key: string]: any }; 
}
