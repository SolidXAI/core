import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAgentSessionDto {
  @IsOptional()
  @IsInt()
  id: number;

  @IsOptional()
  @IsString()
  @ApiProperty()
  sessionId: string;

  @IsOptional()
  @IsInt()
  @ApiProperty()
  userId: number;

  @IsOptional()
  @IsString()
  @ApiProperty()
  projectRoot: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  modelName: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  status: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty()
  totalCost: number;

  @IsOptional()
  @IsInt()
  @ApiProperty()
  totalSteps: number;

  @IsOptional()
  @IsInt()
  @ApiProperty()
  totalInputTokens: number;

  @IsOptional()
  @IsInt()
  @ApiProperty()
  totalOutputTokens: number;

  @IsOptional()
  @IsString()
  @ApiProperty()
  summary: string;

  @IsOptional()
  @IsDate()
  @ApiProperty()
  updatedAt: Date;
}
