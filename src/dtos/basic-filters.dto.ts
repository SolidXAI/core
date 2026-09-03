
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { PaginationQueryDto } from "./pagination-query.dto";
import { Timestamp } from "typeorm";
import { BasicGroupFilterDto } from "./basic-group-filters.dto";
import { ShowSoftDeleted } from "../enums/show-soft-deleted.enum";

// Backwards-compatible alias for consumers using the older DTO name.
export { ShowSoftDeleted as SoftDeleteFilter } from "../enums/show-soft-deleted.enum";

export class BasicFilterDto extends PaginationQueryDto {

    @IsOptional()
    @ApiProperty({ description: "Fields" })
    readonly fields?: string[];

    @IsOptional()
    @ApiProperty({ description: "sort" })
    readonly sort?: string[];

    @IsOptional()
    @ApiProperty({ description: "groupBy" })
    readonly groupBy?: string[];

    @IsOptional()
    @ApiProperty({ description: "aggregates" })
    readonly aggregates?: string[];

    @IsOptional()
    @ApiProperty({ description: "populate" })
    readonly populate?: string[];

    @IsOptional()
    @ApiProperty({ description: "populateMedia" })
    readonly populateMedia?: string[];

    // @IsOptional()
    // @ApiProperty({ description: "filters" })
    // readonly filters: any[];

    @IsOptional()
    @IsEnum(ShowSoftDeleted)
    @ApiProperty({
        description: "showSoftDeleted",
        enum: ShowSoftDeleted,
    })
    readonly showSoftDeleted?: ShowSoftDeleted;

    @IsOptional()
    @ApiProperty({ description: "populateGroup" })
    readonly populateGroup?: boolean;

    @IsOptional()
    @ApiProperty({ description: "groupFilter" })
    groupFilter?: BasicGroupFilterDto

    @IsOptional()
    @ApiProperty({ description: "locale" })
    readonly locale?: string;

    // @IsOptional()
    // @ApiProperty({ description: "default locale id" })
    // readonly defaultEntityLocaleId?: number;
}
