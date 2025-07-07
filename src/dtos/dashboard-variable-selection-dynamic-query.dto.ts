
import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "src/dtos/pagination-query.dto";
import integerTransformer from "../transformers/integer-transformer";

export class DashboardVariableSelectionDynamicQueryDto extends PaginationQueryDto {
    constructor(variableId: number, query: string, limit: number, offset: number) {
        super(limit, offset);
        this.variableId = variableId;
        this.query = query;
    }

    @ApiProperty({ description: "Field ID of the field against which the dynamic value provider is registered.", type: Number })
    @IsNumber()
    @Transform(integerTransformer)
    variableId: number;

    @ApiProperty({ description: "Search query string", type: String })
    @IsString()
    @IsOptional()
    query?: any;

    @ApiProperty({ description: "Value of a single dynamic option", type: String })
    @IsString()
    @IsOptional()
    optionValue?: string = '';
}
