import { IsInt,IsOptional, IsString, IsNotEmpty, IsDate, IsJSON, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateWorkflowStepExecutionDto } from 'src/dtos/update-workflow-step-execution.dto';
import { UpdateWorkflowExecutionLogDto } from 'src/dtos/update-workflow-execution-log.dto';
import { UpdateWorkflowExecutionArtifactDto } from 'src/dtos/update-workflow-execution-artifact.dto';

export class UpdateWorkflowExecutionDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "System-generated readable execution identifier." })
    executionIdentifier: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Workflow definition used to create this execution." })
    workflowDefinitionId: number;

    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Workflow definition used to create this execution." })
    workflowDefinitionUserKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Snapshot of the workflow definition key for easier querying." })
    workflowKey: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Snapshot of the workflow display name at execution time." })
    workflowDisplayName: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Current workflow execution status." })
    status: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Mechanism that started this workflow execution." })
    triggerType: string;

    @IsOptional()
    @IsDate()
    @ApiProperty({ description: "Execution start timestamp." })
    startedAt: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty({ description: "Execution finish timestamp." })
    finishedAt: Date;

    @IsOptional()
    @ApiProperty({ description: "Execution duration in milliseconds." })
    durationMs: bigint;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Runtime inputs supplied to the workflow execution." })
    inputPayload: any;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Flow-level outputs produced by the workflow execution." })
    outputPayload: any;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Definition version used by this execution." })
    definitionVersion: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Definition checksum used by this execution." })
    definitionChecksum: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Exact workflow YAML definition used for this execution." })
    definitionSnapshot: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Human-readable execution failure summary." })
    errorSummary: string;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Structured execution error payload." })
    errorDetails: any;

    @IsOptional()
    @ApiProperty({ description: "User or actor id that requested the execution, if available." })
    requestedByUserId: bigint;

    @IsArray()
    @ValidateNested({ each : true })
    @Type(() => UpdateWorkflowStepExecutionDto)
    @IsOptional()
    workflowStepExecutions: UpdateWorkflowStepExecutionDto[];

    @IsOptional()
    @IsArray()
    workflowStepExecutionIds: number[];

    @IsOptional()
    workflowStepExecutionCommand: string;

    @IsArray()
    @ValidateNested({ each : true })
    @Type(() => UpdateWorkflowExecutionLogDto)
    @IsOptional()
    workflowExecutionLogs: UpdateWorkflowExecutionLogDto[];

    @IsOptional()
    @IsArray()
    workflowExecutionLogIds: number[];

    @IsOptional()
    workflowExecutionLogCommand: string;

    @IsArray()
    @ValidateNested({ each : true })
    @Type(() => UpdateWorkflowExecutionArtifactDto)
    @IsOptional()
    workflowExecutionArtifacts: UpdateWorkflowExecutionArtifactDto[];

    @IsOptional()
    @IsArray()
    workflowExecutionArtifactIds: number[];

    @IsOptional()
    workflowExecutionArtifactCommand: string;
}
