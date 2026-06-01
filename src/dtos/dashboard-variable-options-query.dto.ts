import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "src/dtos/pagination-query.dto";

export class DashboardVariableOptionsQueryDto extends PaginationQueryDto {
    @ApiProperty({ description: "Search query string", type: String, required: false })
    @IsString()
    @IsOptional()
    query?: string;

    @ApiProperty({ description: "Single option value", type: String, required: false })
    @IsString()
    @IsOptional()
    optionValue?: string;

    @ApiProperty({ description: "Form values object serialized as JSON or querystring", required: false })
    @IsOptional()
    formValues?: Record<string, any> | string;
}

