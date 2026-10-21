import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateAgentConfigVersionDto {
    @IsOptional()
    @IsInt()
    @ApiProperty({ required: false })
    id?: number;

    @IsOptional()
    @IsInt()
    @ApiProperty({ required: false })
    versionNumber?: number;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    name?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    description?: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ required: false })
    agentRegistryId?: number;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    agentRegistryUserKey?: string;
}
