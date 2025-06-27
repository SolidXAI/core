import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, ValidateNested, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateDashboardVariableDto } from 'src/dtos/update-dashboard-variable.dto';
import { UpdateQuestionDto } from 'src/dtos/update-question.dto';

export class CreateDashboardDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    name: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    layoutJson: string;
    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateDashboardVariableDto)
    dashboardVariables: UpdateDashboardVariableDto[];
    @IsOptional()
    @IsArray()
    @ApiProperty()
    dashboardVariablesIds: number[];
    @IsString()
    @IsOptional()
    @ApiProperty()
    dashboardVariablesCommand: string;
    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateQuestionDto)
    questions: UpdateQuestionDto[];
    @IsOptional()
    @IsArray()
    @ApiProperty()
    questionsIds: number[];
    @IsString()
    @IsOptional()
    @ApiProperty()
    questionsCommand: string;
}