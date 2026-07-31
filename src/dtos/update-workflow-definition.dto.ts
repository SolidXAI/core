import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkflowDefinitionDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Stable workflow key used as the metadata identity and developer-facing workflow identifier." })
    key: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Owning SolidX module/package used for metadata persistence and distribution." })
    moduleMetadataId: number;

    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Owning SolidX module/package used for metadata persistence and distribution." })
    moduleMetadataUserKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Human-facing workflow name shown in builder and execution screens." })
    displayName: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Optional dot-path grouping for workflows, such as ops.monitoring." })
    namespace: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Workflow description and operational notes." })
    description: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Workflow lifecycle status." })
    status: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Human-managed or seed-managed version string for the current workflow definition." })
    definitionVersion: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Checksum of the canonical definition YAML for change detection and execution traceability." })
    definitionChecksum: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Canonical workflow DSL YAML used for sharing, seeding, validation, and execution." })
    definitionYaml: string;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Optional array of tags for categorizing and searching workflows." })
    tags: any;
}
