import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsJSON, IsInt, IsNumber, ValidateNested, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAgentToolDto } from './update-agent-tool.dto';
import { UpdateAgentSkillDto } from './update-agent-skill.dto';
import { UpdateAgentRoleDto } from './update-agent-role.dto';
import { UpdateAgentSecretDto } from './update-agent-secret.dto';
import { UpdateAgentProcessDto } from './update-agent-process.dto';
import { UpdateAgentSessionDto } from './update-agent-session.dto';
import { UpdateAgentJobDto } from './update-agent-job.dto';

export class CreateAgentRegistryDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    name: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    title: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    system_prompt: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    required_inputs: string = "{}";

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    reasoning_model_key: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    fast_model_key: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    status: string = "draft";

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    step_limit: number;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    turn_step_limit: number;

    @IsNotEmpty()
    @IsNumber()
    @ApiProperty()
    cost_limit: number = 3;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    config_version: number;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentToolDto)
    agentTools: UpdateAgentToolDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentToolsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentToolsCommand: string;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentSkillDto)
    agentSkills: UpdateAgentSkillDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentSkillsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentSkillsCommand: string;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentRoleDto)
    agentRoles: UpdateAgentRoleDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentRolesIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentRolesCommand: string;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentSecretDto)
    agentSecrets: UpdateAgentSecretDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentSecretsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentSecretsCommand: string;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentProcessDto)
    agentProcesses: UpdateAgentProcessDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentProcessesIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentProcessesCommand: string;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentSessionDto)
    agentSessions: UpdateAgentSessionDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentSessionsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentSessionsCommand: string;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentJobDto)
    agentJobs: UpdateAgentJobDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentJobsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentJobsCommand: string;
}
