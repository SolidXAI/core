import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateAgentSkillDto } from './update-agent-skill.dto';

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

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    tags: string;

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
