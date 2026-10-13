import { IsInt,IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAgentRoleDto {
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
    roleMetadataId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    roleMetadataUserKey: string;
}
