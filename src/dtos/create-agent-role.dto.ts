import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString } from 'class-validator';

export class CreateAgentRoleDto {
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
    roleMetadataId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    roleMetadataUserKey: string;
}
