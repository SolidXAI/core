import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAgentContextArchiveDto {
    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    sessionId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    sessionUserKey: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    ref: string;

    @IsNotEmpty()
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
    turnNumber: number = 0;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    stepNumber: number;

    @IsOptional()
    @IsString()
    @ApiProperty()
    compactionId: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    content: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    contentChars: number = 0;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    tokenEstimate: number = 0;
}
