import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAgentEventDto {
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
  turnNumber: number;

  @IsOptional()
  @IsInt()
  @ApiProperty()
  stepNumber: number;

  @IsOptional()
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
  context: string;

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
  reasoningModelKey: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  fastModelKey: string;
}
