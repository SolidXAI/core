import { IsInt,IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAgentSecretDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    agentRegistryId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentRegistryUserKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    secretId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    secretUserKey: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    envVarName: string;
}
