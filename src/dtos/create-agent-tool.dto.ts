import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateAgentToolDto {
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
    @IsBoolean()
    @ApiProperty()
    requiresApproval: boolean = false;
}
