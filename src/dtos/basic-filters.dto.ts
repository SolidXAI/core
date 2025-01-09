
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { PaginationQueryDto } from "src/dtos/pagination-query.dto";


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
    @ApiProperty({ description: "showSoftDeleted" })
    readonly showSoftDeleted?: boolean;

    @IsOptional()
    @ApiProperty({ description: "showOnlySoftDeleted" })
    readonly showOnlySoftDeleted?: boolean;

    @IsOptional()
    @ApiProperty({ description: "populateGroup" })
    readonly populateGroup?: boolean;
}
