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
    callerSnapshot: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    status: string = "queued";

    @IsOptional()
    @IsString()
    @ApiProperty()
    leaseToken: string;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    leaseExpiresAt: Date;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    attempts: number = 0;

    @IsOptional()
    @IsString()
    @ApiProperty()
    idempotencyKey: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    webhookUrl: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    webhookSecret: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    timeoutSeconds: number;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    maxSteps: number;

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
    startedAt: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    finishedAt: Date;

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
