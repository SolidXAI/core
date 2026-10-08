import { IsInt,IsOptional, IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAgentSessionCheckpointDto {
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

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    seq: number;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    turnNumber: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    messages: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    pending: string;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty()
    nCalls: number;

    @IsNotEmpty()
    @IsOptional()
    @IsNumber()
    @ApiProperty()
    cost: number;
}
