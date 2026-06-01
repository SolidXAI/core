import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsObject, IsOptional, IsString } from "class-validator";

export class DashboardWidgetDataRequestDto {
    @ApiProperty({ description: "Runtime variable values", type: Object, required: false })
    @IsOptional()
    @IsObject()
    variables?: Record<string, any>;

    @ApiProperty({ description: "Optional provider context overrides", type: Object, required: false })
    @IsOptional()
    @IsObject()
    providerContext?: Record<string, any>;
}

export class DashboardBatchDataRequestDto extends DashboardWidgetDataRequestDto {
    @ApiProperty({ description: "Subset of widget ids/names to evaluate", type: [String], required: false })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    widgetNames?: string[];
}

export class DashboardSaveLayoutDto {
    @ApiProperty({ description: "Grid/layout payload from UI", type: Object })
    layoutJson: Record<string, any> | any[];

    @ApiProperty({
        description: "Backward-compatible alias for layoutJson.",
        type: Object,
        required: false,
    })
    layout?: Record<string, any> | any[];
}
