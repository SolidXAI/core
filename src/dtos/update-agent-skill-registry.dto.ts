import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateAgentSkillDto } from './update-agent-skill.dto';
import { UpdateAgentHubTagDto } from './update-agent-hub-tag.dto';

export class UpdateAgentSkillRegistryDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    name: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    type: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    iconName?: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    description: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    body: string;

    @IsOptional()
    @ApiProperty({ required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentHubTagDto)
    tags: UpdateAgentHubTagDto[];

    @IsOptional()
    @IsArray()
    @Type(() => Number)
    @IsInt({ each: true })
    @ApiProperty({ required: false })
    tagsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false })
    tagsCommand: string;

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
