import { IsInt,IsOptional, IsString, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAgentToolDto {
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
    agentToolRegistryId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentToolRegistryUserKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    requiresApproval: boolean;
}
