import { IsInt,IsOptional, IsString, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAgentSkillDto {
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
    agentSkillRegistryId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentSkillRegistryUserKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    alwaysInclude: boolean;
}
