import { IsInt,IsOptional, IsString, IsNotEmpty, IsDate, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkflowExecutionLogDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Stable unique key for this workflow execution log entry." })
    logKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Workflow execution this log entry belongs to." })
    workflowExecutionId: number;

    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Workflow execution this log entry belongs to." })
    workflowExecutionUserKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Optional step execution this log entry belongs to when the log is node-scoped." })
    workflowStepExecutionId: number;

    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Optional step execution this log entry belongs to when the log is node-scoped." })
    workflowStepExecutionUserKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Log severity level." })
    level: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Human-readable log message." })
    message: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Structured event type such as execution.started, step.failed, or retry.scheduled." })
    eventType: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Source component or runtime subsystem that emitted the log entry." })
    source: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Workflow node id associated with this log entry, when applicable." })
    nodeId: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Registered node type associated with this log entry, when applicable." })
    nodeType: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Monotonic ordering number for log entries within the execution." })
    sequenceNumber: number;

    @IsNotEmpty()
    @IsOptional()
    @IsDate()
    @ApiProperty({ description: "Timestamp when the log entry was emitted." })
    occurredAt: Date;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Structured context for this log entry." })
    context: any;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Additional metadata captured with this log entry." })
    metadata: any;
}