import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString } from 'class-validator';

export class CreateAgentSecretDto {
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
