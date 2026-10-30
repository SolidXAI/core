import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAgentUserMemoryDto {
  @IsNotEmpty() @IsInt() @ApiProperty() userId: number;
  @IsNotEmpty() @IsInt() @ApiProperty() agentId: number;
  @IsNotEmpty() @IsString() @ApiProperty() memory: string;
  @IsNotEmpty() @IsIn(['explicit', 'implicit']) @ApiProperty({ enum: ['explicit', 'implicit'] }) type: 'explicit' | 'implicit';
  @IsOptional() @IsInt() @ApiProperty({ required: false, nullable: true }) sessionId?: number | null;
}
