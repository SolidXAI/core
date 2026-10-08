import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON, IsDate, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateAgentHumanRequestDto } from './update-agent-human-request.dto';

export class UpdateAgentJobDto {
    @IsOptional()
    @IsInt()
    id: number;

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
    @IsOptional()
    @IsString()
    @ApiProperty()
    kind: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    input: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    callerSnapshot: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    status: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    leaseToken: string;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    leaseExpiresAt: Date;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    attempts: number;

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
