import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsOptional, IsJSON, IsInt, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateDashboardQuestionSqlDatasetConfigDto } from 'src/dtos/update-dashboard-question-sql-dataset-config.dto';

export class CreateDashboardQuestionDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    name: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    sourceType: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    visualisedAs: string;
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "This is only applicable when sourceType is set to provider. It allows the user to select any pre-existing Dashboard Question Data provider implementation used to fetch a dynamic dropdown of values to choose from when this question is presented to the user." })
    providerName: string;
    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Related Dashboard Model" })
    dashboardId: number;
    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Related Dashboard Model" })
    dashboardUserKey: string;
    @IsOptional()
    @ApiProperty({ description: "Related Question SQL Dataset Config Model" })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateDashboardQuestionSqlDatasetConfigDto)
    questionSqlDatasetConfigs: UpdateDashboardQuestionSqlDatasetConfigDto[];
    @IsOptional()
    @IsArray()
    @ApiProperty({ description: "Related Question SQL Dataset Config Model" })
    questionSqlDatasetConfigsIds: number[];
    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Related Question SQL Dataset Config Model" })
    questionSqlDatasetConfigsCommand: string;
    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "This is a JSON object representing each labels display and color options for the bar chart" })
    chartOptions: any;
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "This is the SQL query to fetch the label values for the question" })
    labelSql: string;
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "This is the SQL query to fetch the KPI value for the question" })
    kpiSql: string;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    sequenceNumber: number;
}