import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsNotEmpty, IsJSON, IsDate, ValidateNested, IsArray, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAgentSessionDto } from './update-agent-session.dto';

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

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ required: false, nullable: true, type: String })
    runner?: string | null;

    @IsOptional()
    @IsString()
    @MaxLength(512)
    @ApiProperty({ required: false, nullable: true, type: String, maxLength: 512 })
    runnerRef?: string | null;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, nullable: true, type: String })
    runtimeVersion?: string | null;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiProperty({ required: false, nullable: true, type: Number, minimum: 1 })
    cpu?: number | null;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiProperty({ required: false, nullable: true, type: Number, minimum: 1 })
    memory?: number | null;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    wsUrl: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    status: string = "starting";

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    configVersion: number;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    openSessions: number;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    runningTurns: number;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    maxSessions: number;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    maxRunningTurns: number;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    loadReport: string = "{}";

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
