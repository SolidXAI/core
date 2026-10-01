import { IsInt,IsOptional, IsString, IsNotEmpty, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAgentHumanRequestDto {
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
    jobId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    jobUserKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    kind: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    question: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    options: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    context: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    toolCallId: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    toolName: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    toolArguments: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    status: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    answer: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    answeredBy: string;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    answeredAt: Date;
}
