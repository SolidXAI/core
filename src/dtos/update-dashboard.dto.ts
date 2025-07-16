import { IsInt,IsOptional, IsString, IsNotEmpty, ValidateNested, IsArray, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateDashboardVariableDto } from 'src/dtos/update-dashboard-variable.dto';
import { UpdateDashboardQuestionDto } from 'src/dtos/update-dashboard-question.dto';

export class UpdateDashboardDto {
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