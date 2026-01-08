import { Type } from "class-transformer";
import { IsInt, IsPositive, Min } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";


export class BasicGroupFilterDto {
    @IsOptional()
    @Type(() => Number)
    @IsPositive()
    limit?: number = 10;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;

    @IsOptional()
    @ApiProperty({ description: "sort" })
    sort?: string[];
}
