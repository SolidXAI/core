
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { PaginationQueryDto } from "./pagination-query.dto";
import { Timestamp } from "typeorm";

export enum SoftDeleteFilter {
    INCLUSIVE = "inclusive",
    EXCLUSIVE = "exclusive",
}

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
    @ApiProperty({ description: "populate" })
    readonly populate?: string[];


    @IsOptional()
    @ApiProperty({ description: "populateMedia" })
    readonly populateMedia?: string[];


    // @IsOptional()
    // @ApiProperty({ description: "filters" })
    // readonly filters: any[];

    @IsOptional()
    @IsEnum(SoftDeleteFilter)
    @ApiProperty({
        description: "showSoftDeleted",
        enum: SoftDeleteFilter,
    })
    readonly showSoftDeleted?: SoftDeleteFilter;

    @IsOptional()
    @ApiProperty({ description: "populateGroup" })
    readonly populateGroup?: boolean;

    @IsOptional()
    @ApiProperty({ description: "groupFilter" })
    groupFilter?: BasicFilterDto

    @IsOptional()
    @ApiProperty({ description: "locale" })
    readonly locale?: string;

    @IsOptional()
    @ApiProperty({ description: "status publish draft" })
    readonly status?: string;
}
