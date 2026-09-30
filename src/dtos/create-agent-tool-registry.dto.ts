import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsOptional, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAgentToolDto } from './update-agent-tool.dto';

export class CreateAgentToolRegistryDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    name: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    type: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    source_code: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    checksum: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    status: string = "active";

    @IsOptional()
    @IsString()
    @ApiProperty()
    last_load_error: string;

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
