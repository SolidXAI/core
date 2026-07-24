import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsInt, IsOptional, IsBoolean, IsDate, IsJSON } from 'class-validator';

export class CreateWorkflowTriggerExecutionDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: "Stable unique key for this trigger execution attempt." })
    triggerExecutionKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Workflow definition whose trigger fired or was evaluated." })
    workflowDefinitionId: number;

    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Workflow definition whose trigger fired or was evaluated." })
    workflowDefinitionUserKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "Workflow execution created by this trigger, when a run was started." })
    workflowExecutionId: number;

    @IsString()
    @IsOptional()
    @ApiProperty({ description: "Workflow execution created by this trigger, when a run was started." })
    workflowExecutionUserKey: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: "Trigger id from the workflow definition DSL." })
    triggerId: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Human-readable trigger name captured at execution time." })
    triggerName: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: "Registered trigger type id or broad trigger category." })
    triggerType: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: "Current trigger execution status." })
    status: string = "received";

    @IsOptional()
    @IsBoolean()
    @ApiProperty({ description: "Whether this trigger evaluation matched and should start a workflow execution." })
    matched: boolean = false;

    @IsNotEmpty()
    @IsDate()
    @ApiProperty({ description: "Timestamp when the trigger fired or was received." })
    firedAt: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty({ description: "Timestamp when trigger processing started." })
    startedAt: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty({ description: "Timestamp when trigger processing finished." })
    finishedAt: Date;

    @IsOptional()
    @ApiProperty({ description: "Trigger processing duration in milliseconds." })
    durationMs: bigint;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Source system, scheduler, webhook endpoint, or event bus that produced the trigger." })
    source: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "External correlation id for linking trigger attempts to upstream events." })
    correlationId: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Optional idempotency key used to prevent duplicate trigger handling." })
    idempotencyKey: string;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Trigger payload, request body, schedule context, or event data." })
    payload: any;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Snapshot of the trigger definition used for this trigger execution." })
    triggerSnapshot: any;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Short human-readable error summary for failed trigger executions." })
    errorSummary: string;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Structured error details captured for failed trigger executions." })
    errorDetails: any;

    @IsOptional()
    @IsJSON()
    @ApiProperty({ description: "Additional trigger execution metadata." })
    metadata: any;
}