import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateAgentSkillDto {
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
    @IsBoolean()
    @ApiProperty()
    alwaysInclude: boolean = true;
}
