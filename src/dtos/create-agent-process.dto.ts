import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsNotEmpty, IsJSON, IsDate, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAgentHubSessionDto } from './update-agent-hub-session.dto';

export class CreateAgentProcessDto {
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
    host: string;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    port: number;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    pid: number;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    ws_url: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    status: string = "starting";

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    config_version: number;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    open_sessions: number;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    running_turns: number;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    max_sessions: number;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    max_running_turns: number;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    load_report: string = "{}";

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
