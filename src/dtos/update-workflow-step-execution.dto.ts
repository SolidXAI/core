import { IsInt,IsOptional, IsString, IsNotEmpty, IsDate, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkflowStepExecutionDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Stable unique key for this step execution, assigned by the runtime." })
    stepExecutionKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Parent workflow execution this step belongs to." })
    workflowExecutionId: number;

    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Parent workflow execution this step belongs to." })
    workflowExecutionUserKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Node id from the workflow definition DSL." })
    nodeId: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Human-readable node name captured at execution time." })
    nodeName: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Broad node category." })
    nodeKind: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Registered node type id such as log.write, http.request, if, forEach, or parallel." })
    nodeType: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Current step execution status." })
    status: string;

    @IsNotEmpty()
    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Current attempt number for this step execution." })
    attemptNumber: number;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Number of retries attempted for this step." })
    retryCount: number;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Maximum retry count resolved for this step." })
    maxRetries: number;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Parent control or subflow node id when this step is nested." })
    parentNodeId: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Parent step execution key for nested runtime structures." })
    parentStepExecutionKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Traversal or scheduling sequence number within the workflow execution." })
    sequenceNumber: number;

    @IsOptional()
    @IsDate()
    @ApiProperty({ description: "Step start timestamp." })
    startedAt: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty({ description: "Step finish timestamp." })
    finishedAt: Date;

    @IsOptional()
    @ApiProperty({ description: "Step duration in milliseconds." })
    durationMs: bigint;

    @IsOptional()
    @ApiProperty({ description: "Timeout resolved for this step in milliseconds." })
    timeoutMs: bigint;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Input payload resolved for this step execution." })
    inputPayload: any;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Output payload produced by this step execution." })
    outputPayload: any;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Scoped runtime context used while executing this step." })
    runtimeContext: any;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Snapshot of the workflow node definition used for this step execution." })
    nodeSnapshot: any;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Short human-readable error summary for failed steps." })
    errorSummary: string;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Structured error details captured for failed steps." })
    errorDetails: any;
}