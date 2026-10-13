import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { UpdateAgentSkillRegistryDto } from './update-agent-skill-registry.dto';
import { UpdateAgentToolRegistryDto } from './update-agent-tool-registry.dto';
import { UpdateAgentRegistryDto } from './update-agent-registry.dto';

export class CreateAgentHubTagDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    name: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentSkillRegistryDto)
    @ApiProperty({ required: false })
    skills: UpdateAgentSkillRegistryDto[];

    @IsOptional()
    @IsArray()
    @Type(() => Number)
    @IsInt({ each: true })
    @ApiProperty({ required: false })
    skillsIds: number[];

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    skillsCommand: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentToolRegistryDto)
    @ApiProperty({ required: false })
    tools: UpdateAgentToolRegistryDto[];

    @IsOptional()
    @IsArray()
    @Type(() => Number)
    @IsInt({ each: true })
    @ApiProperty({ required: false })
    toolsIds: number[];

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    toolsCommand: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAgentRegistryDto)
    @ApiProperty({ required: false })
    agents: UpdateAgentRegistryDto[];

    @IsOptional()
    @IsArray()
    @Type(() => Number)
    @IsInt({ each: true })
    @ApiProperty({ required: false })
    agentsIds: number[];

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    agentsCommand: string;
}
