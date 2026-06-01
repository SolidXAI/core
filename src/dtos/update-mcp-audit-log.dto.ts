import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateMcpAuditLogDto {
  @IsOptional()
  @IsInt()
  id: number;

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

  @IsOptional()
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

  @IsOptional()
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

  @IsOptional()
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
}
