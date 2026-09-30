import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsNotEmpty, IsJSON, IsNumber, IsDate, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAgentJobDto } from './update-agent-job.dto';
import { UpdateAgentEventDto } from './update-agent-event.dto';
import { UpdateAgenthubSessionCheckpointDto } from './update-agenthub-session-checkpoint.dto';
import { UpdateAgentHumanRequestDto } from './update-agent-human-request.dto';

export class CreateAgentSessionDto {
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
    @IsString()
    @ApiProperty({ description: "queued: Background session waiting for its first job to be claimed; active: Interactive session open, waiting for the user's next message; running: A turn is executing; awaiting_input: Parked on a request_human_input question; awaiting_approval: Parked on a tool approval; completed, failed, cancelled, expired: Terminal." })
    status: string = "queued";

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    inputs: string = "{}";

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    config_version: number;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    turn_count: number = 0;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    total_steps: number = 0;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    total_input_tokens: number = 0;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    total_output_tokens: number = 0;

    @IsNotEmpty()
    @IsNumber()
    @ApiProperty()
    total_cost: number;

    @IsOptional()
    @IsString()
    @ApiProperty()
    error: string;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    ended_at: Date;

    @IsOptional()
    @IsString()
    @ApiProperty()
    reasoning_model_key: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    fast_model_key: string;

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
    @Type(() => UpdateAgenthubSessionCheckpointDto)
    agenthubSessionCheckpoints: UpdateAgenthubSessionCheckpointDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agenthubSessionCheckpointsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agenthubSessionCheckpointsCommand: string;

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
