import { IsInt,IsOptional, IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAgenthubSessionCheckpointDto {
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
    turn_number: number;

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
    n_calls: number;

    @IsNotEmpty()
    @IsOptional()
    @IsNumber()
    @ApiProperty()
    cost: number;
}
