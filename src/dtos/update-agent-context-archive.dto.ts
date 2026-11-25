import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateAgentContextArchiveDto {
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
    @IsString()
    @ApiProperty()
    ref: string;

    @IsOptional()
    @IsIn(['tool_result', 'transcript'])
    @ApiProperty()
    kind: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    toolCallId: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    toolName: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    turnNumber: number;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    stepNumber: number;

    @IsOptional()
    @IsString()
    @ApiProperty()
    compactionId: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    content: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    contentChars: number;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    tokenEstimate: number;
}
