import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAgentSessionDto {
  @IsNotEmpty()
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

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  modelName: string;

  @IsNotEmpty()
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
  createdAt: Date;

  @IsOptional()
  @IsDate()
  @ApiProperty()
  updatedAt: Date;
}
