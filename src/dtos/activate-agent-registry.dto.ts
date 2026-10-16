import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ActivateAgentRegistryDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    name?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    description?: string;
}
