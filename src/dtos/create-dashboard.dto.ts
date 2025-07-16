import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, ValidateNested, IsArray, IsOptional, IsJSON, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateDashboardVariableDto } from 'src/dtos/update-dashboard-variable.dto';
import { UpdateDashboardQuestionDto } from 'src/dtos/update-dashboard-question.dto';

export class CreateDashboardDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    name: string;
    @IsNotEmpty()
    @IsJSON()
    @ApiProperty()
    layoutJson: any;
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
    @Type(() => UpdateDashboardQuestionDto)
    questions: UpdateDashboardQuestionDto[];
    @IsOptional()
    @IsArray()
    @ApiProperty()
    questionsIds: number[];
    @IsString()
    @IsOptional()
    @ApiProperty()
    questionsCommand: string;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    moduleId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    moduleUserKey: string;
}