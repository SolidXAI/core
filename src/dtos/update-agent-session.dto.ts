import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON, IsNumber, IsDate, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateAgentJobDto } from './update-agent-job.dto';
import { UpdateAgentEventDto } from './update-agent-event.dto';
import { UpdateAgentSessionCheckpointDto } from './update-agent-session-checkpoint.dto';
import { UpdateAgentHumanRequestDto } from './update-agent-human-request.dto';

export class UpdateAgentSessionDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    agentId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentUserKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    processId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    processUserKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    trigger: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    userId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    userUserKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "queued: Background session waiting for its first job to be claimed; active: Interactive session open, waiting for the user's next message; running: A turn is executing; awaiting_input: Parked on a request_human_input question; awaiting_approval: Parked on a tool approval; completed, failed, cancelled, expired: Terminal." })
    status: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    inputs: string;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    configVersion: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    turnCount: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    totalSteps: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    totalInputTokens: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    totalOutputTokens: number;

    @IsNotEmpty()
    @IsOptional()
    @IsNumber()
    @ApiProperty()
    totalCost: number;

    @IsOptional()
    @IsString()
    @ApiProperty()
    error: string;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    endedAt: Date;

    @IsOptional()
    @IsString()
    @ApiProperty()
    reasoningModelKey: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    fastModelKey: string;

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

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentEventDto)
    agentEvents: UpdateAgentEventDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentEventsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentEventsCommand: string;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentSessionCheckpointDto)
    agentSessionCheckpoints: UpdateAgentSessionCheckpointDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentSessionCheckpointsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentSessionCheckpointsCommand: string;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentHumanRequestDto)
    agentHumanRequests: UpdateAgentHumanRequestDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentHumanRequestsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentHumanRequestsCommand: string;
}
