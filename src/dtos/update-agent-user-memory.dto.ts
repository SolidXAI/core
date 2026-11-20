import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateAgentUserMemoryDto {
  @IsOptional() @IsInt() @ApiProperty({ required: false }) id?: number;
  @IsOptional() @IsInt() @ApiProperty({ required: false }) userId?: number;
  @IsOptional() @IsInt() @ApiProperty({ required: false }) agentId?: number;
  @IsOptional() @IsString() @ApiProperty({ required: false }) memory?: string;
  @IsOptional() @IsIn(['explicit', 'implicit']) @ApiProperty({ enum: ['explicit', 'implicit'], required: false }) type?: 'explicit' | 'implicit';
  @IsOptional() @IsInt() @ApiProperty({ required: false, nullable: true }) sessionId?: number | null;
}
