import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAgentEventDto {
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
  turnNumber: number;

  @IsOptional()
  @IsInt()
  @ApiProperty()
  stepNumber: number;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  eventType: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  eventData: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  content: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  toolName: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  toolArguments: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  toolOutput: string;

  @IsOptional()
  @IsInt()
  @ApiProperty()
  toolReturncode: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty()
  durationMs: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty()
  cost: number;

  @IsOptional()
  @IsInt()
  @ApiProperty()
  inputTokens: number;

  @IsOptional()
  @IsInt()
  @ApiProperty()
  outputTokens: number;

  @IsOptional()
  @IsString()
  @ApiProperty()
  reasoning_model_key: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  fast_model_key: string;

  @IsOptional()
  @IsDate()
  @ApiProperty()
  createdAt: Date;
}
