import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';

export class UpdateAgentDeploymentDto {
  @ApiPropertyOptional({ enum: ['local', 'docker', 'ecs'], nullable: true })
  @IsOptional()
  @IsIn(['local', 'docker', 'ecs'])
  runner?: 'local' | 'docker' | 'ecs' | null;

  @ApiPropertyOptional({ minimum: 0 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  minProcesses?: number;

  @ApiPropertyOptional({ nullable: true, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxProcesses?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  processCpu?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  processMemory?: number | null;
}
