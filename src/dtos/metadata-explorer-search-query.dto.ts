import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsOptional, IsString, Min } from "class-validator";
import { PaginationQueryDto } from "./pagination-query.dto";

export class MetadataExplorerSearchQueryDto extends PaginationQueryDto {
    @ApiProperty({ description: "Search query string", required: false, type: String })
    @IsString()
    @IsOptional()
    query?: string;

    @ApiProperty({ description: "Optional section key to scope the search", required: false, type: String })
    @IsString()
    @IsOptional()
    sectionKey?: string;

    @ApiProperty({ description: "Whether to match the full value exactly", required: false, type: Boolean, default: false })
    @Type(() => Boolean)
    @IsBoolean()
    @IsOptional()
    exact?: boolean = false;

    @ApiProperty({ description: "Maximum preview length for match snippets", required: false, type: Number, default: 120 })
    @Type(() => Number)
    @Min(20)
    @IsOptional()
    previewLength?: number = 120;
}
