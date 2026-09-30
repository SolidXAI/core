import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsNotEmpty, IsDate } from 'class-validator';

export class CreateAgentHumanRequestDto {
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
    @IsString()
    @ApiProperty()
    kind: string;

    @IsNotEmpty()
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
    @IsString()
    @ApiProperty()
    tool_call_id: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    tool_name: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    tool_arguments: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    status: string = "pending";

    @IsOptional()
    @IsString()
    @ApiProperty()
    answer: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    answered_by: string;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    answered_at: Date;
}
