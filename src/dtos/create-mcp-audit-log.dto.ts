import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMcpAuditLogDto {
  @IsOptional()
  @IsInt()
  @ApiProperty()
  userId: number;

  @IsOptional()
  @IsInt()
  @ApiProperty()
  apiKeyId: number;

  @IsOptional()
  @IsString()
  @ApiProperty()
  username: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  transport: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  mcpSessionId: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  clientAddr: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  method: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  requestId: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  toolName: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  requestParams: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  status: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  responseResult: string;

  @IsOptional()
  @IsInt()
  @ApiProperty()
  errorCode: number;

  @IsOptional()
  @IsString()
  @ApiProperty()
  errorMessage: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty()
  durationMs: number;

  @IsOptional()
  @IsDate()
  @ApiProperty()
  createdAt: Date;
}
