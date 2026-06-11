import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "./pagination-query.dto";

export class MetadataExplorerReferencesQueryDto extends PaginationQueryDto {
    @ApiProperty({ description: "Value or key to locate references for", required: false, type: String })
    @IsString()
    @IsOptional()
    needle?: string;

    @ApiProperty({ description: "Optional section key to scope the reference search", required: false, type: String })
    @IsString()
    @IsOptional()
    sectionKey?: string;

    @ApiProperty({ description: "Optional JSON path to exclude from results", required: false, type: String })
    @IsString()
    @IsOptional()
    excludePath?: string;

    @ApiProperty({ description: "Whether to match the full key/value exactly", required: false, type: Boolean, default: true })
    @Type(() => Boolean)
    @IsBoolean()
    @IsOptional()
    exact?: boolean = true;

    @ApiProperty({ description: "Whether object keys should be considered when finding references", required: false, type: Boolean, default: true })
    @Type(() => Boolean)
    @IsBoolean()
    @IsOptional()
    matchKeys?: boolean = true;

    @ApiProperty({ description: "Whether primitive values should be considered when finding references", required: false, type: Boolean, default: true })
    @Type(() => Boolean)
    @IsBoolean()
    @IsOptional()
    matchValues?: boolean = true;
}
