import { IsInt, IsOptional, IsString, IsNotEmpty, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateQuestionSqlDatasetConfigDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    datasetName: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "This is the display name for the dataset configuration, which can be used in UI components to represent the dataset in a user-friendly manner." })
    datasetDisplayName: string;
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "This is a description of the dataset configuration, providing context and details about its purpose." })
    description: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    sql: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    labelColumnName: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    valueColumnName: string;
    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Related Question Model" })
    questionId: number;
    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Related Question Model" })
    questionUserKey: string;
    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "This allows you to set the dataset options e.g border-color, background-color, etc. This is a JSON object that can be used to customize the dataset appearance or behavior in the UI." })
    options: any;
}