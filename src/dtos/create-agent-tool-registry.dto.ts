import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';
import { IsNotEmpty, IsOptional, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAgentToolDto } from './update-agent-tool.dto';
import { UpdateAgentHubTagDto } from './update-agent-hub-tag.dto';

export class CreateAgentToolRegistryDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    name: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    type: string;

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
    sourceCode: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    checksum?: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    status: string = "inactive";

    @IsOptional()
    @IsString()
    @ApiProperty()
    lastLoadError: string;

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
    @Type(() => UpdateAgentToolDto)
    agentTools: UpdateAgentToolDto[];

    @IsOptional()
    @IsArray()
    @ApiProperty()
    agentToolsIds: number[];

    @IsString()
    @IsOptional()
    @ApiProperty()
    agentToolsCommand: string;
}
