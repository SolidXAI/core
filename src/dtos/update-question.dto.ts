import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateQuestionDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    name: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    sourceType: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    visualisedAs: string;
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "This is the raw SQL query to be used to fetch the data for this question" })
    sql: string;
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "This is only applicable when sourceType is set to provider. It allows the user to select any pre-existing Dashboard Question Data provider implementation used to fetch a dynamic dropdown of values to choose from when this question is presented to the user." })
    providerName: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    barChartXKey: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    barChartSeriesKey: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    barChartValueKey: string;
    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "This is a JSON object representing each labels display and color options for the bar chart" })
    barChartLabelOptions: any;
    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Related Dashboard Model" })
    dashboardId: number;
    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Related Dashboard Model" })
    dashboardUserKey: string;
}