import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsNotEmpty, IsJSON, IsNumber, IsDate, ValidateNested, IsArray, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAgentJobDto } from './update-agent-job.dto';
import { UpdateAgentEventDto } from './update-agent-event.dto';
import { UpdateAgentSessionCheckpointDto } from './update-agent-session-checkpoint.dto';
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
    @IsString()
    @IsIn(["solidx", "agentHub"])
    @ApiProperty({ enum: ["solidx", "agentHub"], required: false })
    runtime: "solidx" | "agentHub";

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
    configVersion: number;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    turnCount: number = 0;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    totalSteps: number = 0;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    totalInputTokens: number = 0;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    totalOutputTokens: number = 0;

    @IsNotEmpty()
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
