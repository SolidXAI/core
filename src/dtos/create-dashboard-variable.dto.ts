import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsJSON, IsOptional, IsBoolean, IsInt } from 'class-validator';

export enum SelectionDynamicSourceType {
    SQL = "sql",
    PROVIDER = "provider",
}


export class CreateDashboardVariableDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    variableName: string;
    @IsNotEmpty()
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
    @ApiProperty({ description: "This is only applicable when selectionDynamicSourceType is set to provider. It allows the user to select any pre-existing Dashboard SelectionDynamicProvider implementation used to fetch a dynamic dropdown of values to choose from when this variable is presented to the user." })
    selectionDynamicProviderName: string;
    @IsOptional()
    @IsBoolean()
    @ApiProperty({ description: "This is relevant only for variables of type \"selectionStatic\" or \"selectionDynamic\". When set to true, it allows the user to select multiple values from the dropdown." })
    isMultiSelect: boolean = true;
    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Related Dashboard Model" })
    dashboardId: number;
    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Related Dashboard Model" })
    dashboardUserKey: string;
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "This is the default value for this variable when it is rendered at runtime. It can be a static value for this variable when it is rendered at runtime." })
    defaultValue: string;
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "This is the default operator for this variable when it is rendered at runtime. It can be a static value for this variable when it is rendered at runtime." })
    defaultOperator: string;
    @IsString()
    @IsOptional()
    @ApiProperty()
    externalId: string;
}