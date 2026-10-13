import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON, IsDate, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateAgentSessionDto } from './update-agent-session.dto';

export class UpdateAgentProcessDto {
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

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    host: string;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    port: number;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    pid: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    wsUrl: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    status: string;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    configVersion: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    openSessions: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    runningTurns: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    maxSessions: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    maxRunningTurns: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    loadReport: string;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    heartbeatAt: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    stoppedAt: Date;

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
}
