import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDashboardVariableDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    variableName: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    variableType: string;
    @IsOptional()
    @IsJSON()
    @ApiProperty()
    selectionStaticValues: any;
    @IsOptional()
    @IsString()
    @ApiProperty()
    selectionDynamicSourceType: string;
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "SQL query to fetch the data for this variable when it is rendered at runtime. This is only applicable when selectionDynamicSourceType is set to SQL." })
    selectionDynamicSQL: string;
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "This is only applicable when selectionDynamicSourceType is set to provider. It allows the user to select any pre-existing SelectionDynamicProvider implementation used to fetch a dynamic dropdown of values to choose from when this variable is presented to the user." })
    selectionDynamicProviderName: string;
    @IsOptional()
    @IsBoolean()
    @ApiProperty({ description: "This is relevant only for variables of type selectionStatic or selectionDynamic. When set to true, it allows the user to select multiple values from the dropdown." })
    isMultiSelect: boolean;
    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Related Dashboard Model" })
    dashboardId: number;
    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Related Dashboard Model" })
    dashboardUserKey: string;
}