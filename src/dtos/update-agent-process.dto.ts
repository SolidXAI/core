import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON, IsDate, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateAgentHubSessionDto } from './update-agent-hub-session.dto';

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
    ws_url: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    status: string;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    config_version: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    open_sessions: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    running_turns: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    max_sessions: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    max_running_turns: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    load_report: string;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    heartbeat_at: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    stopped_at: Date;

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentHubSessionDto)
    agentHubSessions: UpdateAgentHubSessionDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentHubSessionsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentHubSessionsCommand: string;
}
