import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsJSON, ValidateNested, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAgentSkillDto } from './update-agent-skill.dto';

export class CreateAgentSkillRegistryDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    name: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    iconName?: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    description: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    body: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    tags: string = "{}";

    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentSkillDto)
    agentSkills: UpdateAgentSkillDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentSkillsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentSkillsCommand: string;
}
