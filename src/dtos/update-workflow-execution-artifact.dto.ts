import { IsInt,IsOptional, IsString, IsNotEmpty, IsDate, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkflowExecutionArtifactDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Stable unique key for this execution artifact." })
    artifactKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Workflow execution this artifact belongs to." })
    workflowExecutionId: number;

    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Workflow execution this artifact belongs to." })
    workflowExecutionUserKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Optional step execution that produced this artifact." })
    workflowStepExecutionId: number;

    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Optional step execution that produced this artifact." })
    workflowStepExecutionUserKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Human-readable artifact name." })
    name: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Optional artifact description." })
    description: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Artifact storage or payload category." })
    artifactType: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Workflow node id that produced this artifact, when applicable." })
    nodeId: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Registered node type that produced this artifact, when applicable." })
    nodeType: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Storage provider key when this artifact is stored outside the database." })
    storageProviderKey: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "External URI, storage path, or download URL for the artifact." })
    uri: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Original or generated file name for file artifacts." })
    fileName: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "MIME type for file or binary artifacts." })
    mimeType: string;

    @IsOptional()
    @ApiProperty({ description: "Artifact size in bytes, when known." })
    sizeBytes: bigint;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Artifact checksum or content hash, when available." })
    checksum: string;

    @IsOptional()
    @IsDate()
    @ApiProperty({ description: "Timestamp when the artifact was produced." })
    producedAt: Date;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Inline structured artifact payload for small DB-stored artifacts." })
    payload: any;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Additional artifact metadata." })
    metadata: any;
}