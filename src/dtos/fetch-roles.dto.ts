

import { IsNotEmpty, IsOptional } from "class-validator";
import { PaginationQueryDto } from "src/dtos/pagination-query.dto";

export class FetchRolesDto extends PaginationQueryDto {
    @IsNotEmpty()
    @IsOptional()
    roleName : string;
}


