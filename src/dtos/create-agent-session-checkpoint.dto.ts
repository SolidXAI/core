import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateAgentSessionCheckpointDto {
    @IsOptional()
    @IsInt()
    @ApiProperty()
    sessionId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    sessionUserKey: string;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    seq: number;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    turnNumber: number;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    messages: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    pending: string;

    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    nCalls: number = 0;

    @IsNotEmpty()
    @IsNumber()
    @ApiProperty()
    cost: number;
}
