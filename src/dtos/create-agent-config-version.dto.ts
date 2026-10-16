import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAgentConfigVersionDto {
    @IsInt()
    @ApiProperty()
    versionNumber: number;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    name?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    description?: string;

    @IsInt()
    @ApiProperty()
    agentRegistryId: number;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    agentRegistryUserKey?: string;
}
