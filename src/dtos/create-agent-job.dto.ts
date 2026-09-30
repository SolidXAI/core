import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsNotEmpty, IsJSON, IsDate, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAgentHumanRequestDto } from './update-agent-human-request.dto';

export class CreateAgentJobDto {
    @IsOptional()
    @IsInt()
    @ApiProperty()
    sessionId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    sessionUserKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    agentId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentUserKey: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    kind: string = "start";

    @IsOptional()
    @IsString()
    @ApiProperty()
    input: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    caller_snapshot: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    status: string = "queued";

    @IsOptional()
    @IsString()
    @ApiProperty()
    lease_token: string;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    lease_expires_at: Date;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    attempts: number = 0;

    @IsOptional()
    @IsString()
    @ApiProperty()
    idempotency_key: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    webhook_url: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    webhook_secret: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    timeout_seconds: number;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    max_steps: number;

    @IsOptional()
    @IsString()
    @ApiProperty()
    result: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    error: string;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    started_at: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    finished_at: Date;

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
