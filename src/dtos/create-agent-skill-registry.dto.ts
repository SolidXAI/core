import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';
import { IsNotEmpty, IsJSON, ValidateNested, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAgentSkillDto } from './update-agent-skill.dto';
import { UpdateAgentHubTagDto } from './update-agent-hub-tag.dto';

export class CreateAgentSkillRegistryDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    name: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    type: string = "custom";

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
