import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowExecutionArtifact } from '../../entities/workflow-execution-artifact.entity';
import { WorkflowExecutionLog } from '../../entities/workflow-execution-log.entity';
import { WorkflowExecution } from '../../entities/workflow-execution.entity';
import { WorkflowStepExecution } from '../../entities/workflow-step-execution.entity';
import {
  WorkflowArtifactEmitRequest,
  WorkflowExecutionRequest,
  WorkflowLogEmitRequest,
  WorkflowNodeDefinition,
  WorkflowStepExecutionStatus,
} from '../../types/workflow-dsl.types';

@Injectable()
export class WorkflowExecutionWriterService {
  constructor(
    @InjectEntityManager('default')
    private readonly entityManager: EntityManager,
  ) {}

  async createExecution(
    definition: WorkflowDefinition,
    request: WorkflowExecutionRequest,
  ): Promise<WorkflowExecution> {
    const execution = this.entityManager.create(WorkflowExecution, {
      executionIdentifier: this.createKey('wf'),
      workflowDefinition: definition,
      workflowKey: definition.key,
      workflowDisplayName: definition.displayName,
      status: 'running',
      triggerType: request.triggerType ?? 'manual',
      startedAt: new Date(),
      inputPayload: request.input ?? {},
      definitionVersion: definition.definitionVersion,
      definitionChecksum: definition.definitionChecksum,
      definitionSnapshot: definition.definitionJson,
      requestedByUserId: request.requestedByUserId as any,
    });

    return this.entityManager.save(WorkflowExecution, execution);
  }

  async completeExecution(
    execution: WorkflowExecution,
    outputPayload: any,
  ): Promise<WorkflowExecution> {
    const finishedAt = new Date();
    execution.status = 'success';
    execution.finishedAt = finishedAt;
    execution.durationMs = this.duration(execution.startedAt, finishedAt) as any;
    execution.outputPayload = outputPayload;
    return this.entityManager.save(WorkflowExecution, execution);
  }

  async failExecution(
    execution: WorkflowExecution,
    error: unknown,
  ): Promise<WorkflowExecution> {
    const finishedAt = new Date();
    execution.status = 'failed';
    execution.finishedAt = finishedAt;
    execution.durationMs = this.duration(execution.startedAt, finishedAt) as any;
    execution.errorSummary = this.errorMessage(error);
    execution.errorDetails = this.errorDetails(error);
    return this.entityManager.save(WorkflowExecution, execution);
  }

  async createStep(
    execution: WorkflowExecution,
    node: WorkflowNodeDefinition,
    sequenceNumber: number,
    inputPayload: any,
    parentNodeId?: string,
    parentStepExecutionKey?: string,
  ): Promise<WorkflowStepExecution> {
    const step = this.entityManager.create(WorkflowStepExecution, {
      stepExecutionKey: this.createKey('step'),
      workflowExecution: execution,
      nodeId: node.id,
      nodeName: node.name,
      nodeKind: node.kind,
      nodeType: node.type,
      status: 'running',
      attemptNumber: 1,
      retryCount: 0,
      maxRetries: node.retryPolicy?.maxRetries,
      parentNodeId,
      parentStepExecutionKey,
      sequenceNumber,
      startedAt: new Date(),
      timeoutMs: node.timeoutMs as any,
      inputPayload,
      nodeSnapshot: node,
    });

    return this.entityManager.save(WorkflowStepExecution, step);
  }

  async completeStep(
    step: WorkflowStepExecution,
    status: WorkflowStepExecutionStatus,
    outputPayload: any,
    runtimeContext?: any,
  ): Promise<WorkflowStepExecution> {
    const finishedAt = new Date();
    step.status = status;
    step.finishedAt = finishedAt;
    step.durationMs = this.duration(step.startedAt, finishedAt) as any;
    step.outputPayload = outputPayload;
    step.runtimeContext = runtimeContext;
    return this.entityManager.save(WorkflowStepExecution, step);
  }

  async failStep(
    step: WorkflowStepExecution,
    error: unknown,
  ): Promise<WorkflowStepExecution> {
    const finishedAt = new Date();
    step.status = 'failed';
    step.finishedAt = finishedAt;
    step.durationMs = this.duration(step.startedAt, finishedAt) as any;
    step.errorSummary = this.errorMessage(error);
    step.errorDetails = this.errorDetails(error);
    return this.entityManager.save(WorkflowStepExecution, step);
  }

  async writeLog(
    execution: WorkflowExecution,
    step: WorkflowStepExecution | undefined,
    entry: WorkflowLogEmitRequest,
    sequenceNumber: number,
  ): Promise<WorkflowExecutionLog> {
    const log = this.entityManager.create(WorkflowExecutionLog, {
      logKey: this.createKey('log'),
      workflowExecution: execution,
      workflowStepExecution: step,
      level: entry.level ?? 'info',
      message: entry.message,
      eventType: entry.eventType,
      source: entry.source ?? 'workflow-engine',
      nodeId: step?.nodeId,
      nodeType: step?.nodeType,
      sequenceNumber,
      occurredAt: new Date(),
      context: entry.context,
      metadata: entry.metadata,
    });

    return this.entityManager.save(WorkflowExecutionLog, log);
  }

  async writeArtifact(
    execution: WorkflowExecution,
    step: WorkflowStepExecution | undefined,
    entry: WorkflowArtifactEmitRequest,
  ): Promise<WorkflowExecutionArtifact> {
    const artifact = this.entityManager.create(WorkflowExecutionArtifact, {
      artifactKey: this.createKey('artifact'),
      workflowExecution: execution,
      workflowStepExecution: step,
      name: entry.name,
      description: entry.description,
      artifactType: entry.artifactType ?? 'payload',
      nodeId: step?.nodeId,
      nodeType: step?.nodeType,
      uri: entry.uri,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
      sizeBytes: entry.sizeBytes as any,
      checksum: entry.checksum,
      producedAt: new Date(),
      payload: entry.payload,
      metadata: entry.metadata,
    });

    return this.entityManager.save(WorkflowExecutionArtifact, artifact);
  }

  private createKey(prefix: string): string {
    return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  private duration(startedAt?: Date, finishedAt = new Date()): number {
    return startedAt ? finishedAt.getTime() - startedAt.getTime() : 0;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private errorDetails(error: unknown): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return { error };
  }
}
