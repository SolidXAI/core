import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON, IsNumber, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateAgentToolDto } from './update-agent-tool.dto';
import { UpdateAgentSkillDto } from './update-agent-skill.dto';
import { UpdateAgentRoleDto } from './update-agent-role.dto';
import { UpdateAgentSecretDto } from './update-agent-secret.dto';
import { UpdateAgentProcessDto } from './update-agent-process.dto';
import { UpdateAgentSessionDto } from './update-agent-session.dto';
import { UpdateAgentJobDto } from './update-agent-job.dto';

export class UpdateAgentRegistryDto {
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
    title: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    description?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    iconName?: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    systemPrompt: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    requiredInputs: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    reasoningModelKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    fastModelKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    status: string;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    stepLimit: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    turnStepLimit: number;

    @IsNotEmpty()
    @IsOptional()
    @IsNumber()
    @ApiProperty()
    costLimit: number;

    @IsOptional()
    @IsInt()
    @ApiProperty({ required: false })
    configVersion?: number;

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
