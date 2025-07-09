import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateQuestionSqlDatasetConfigDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    datasetName: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: "This is the display name for the dataset configuration, which can be used in UI components to represent the dataset in a user-friendly manner." })
    datasetDisplayName: string;
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "This is a description of the dataset configuration, providing context and details about its purpose." })
    description: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    sql: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    labelColumnName: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    valueColumnName: string;
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "This is the background color for the chart, if applicable. It can be a hex color code or a color name." })
    backgroundColor: string;
    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Related Question Model" })
    questionId: number;
    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Related Question Model" })
    questionUserKey: string;
}