import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowExecution } from '../../entities/workflow-execution.entity';
import { WorkflowStepExecution } from '../../entities/workflow-step-execution.entity';
import {
  WorkflowDefinitionDsl,
  WorkflowExecutionRequest,
  WorkflowExecutionResponse,
  WorkflowNodeDefinition,
  WorkflowRuntimeContext,
} from '../../types/workflow-dsl.types';
import { WorkflowExecutionWriterService } from './workflow-execution-writer.service';
import { WorkflowExpressionService } from './workflow-expression.service';
import { WorkflowDefinitionValidatorService } from './workflow-definition-validator.service';
import { WorkflowNodeRegistryService } from './workflow-node-registry.service';
import { WorkflowSecretService } from '../workflow-secret.service';
import { PublisherFactory } from '../queues/publisher-factory.service';
import { WorkflowExecutionQueuePayload } from '../../types/workflow-execution-queue.types';
import YAML from 'yaml';

@Injectable()
export class WorkflowRuntimeService {
  private readonly logger = new Logger(WorkflowRuntimeService.name);

  constructor(
    @InjectEntityManager('default')
    private readonly entityManager: EntityManager,
    private readonly registry: WorkflowNodeRegistryService,
    private readonly expression: WorkflowExpressionService,
    private readonly writer: WorkflowExecutionWriterService,
    private readonly validator: WorkflowDefinitionValidatorService,
    private readonly workflowSecretService: WorkflowSecretService,
    private readonly workflowExecutionPublisherFactory: PublisherFactory<WorkflowExecutionQueuePayload>,
  ) {}

  async executeDefinitionById(
    id: number,
    request: WorkflowExecutionRequest,
  ): Promise<WorkflowExecutionResponse> {
    const definition = await this.entityManager.findOne(WorkflowDefinition, {
      where: { id } as any,
    });

    return this.executeDefinition(definition, request);
  }

  async executeDefinitionByIdAsync(
    id: number,
    request: WorkflowExecutionRequest = {},
  ): Promise<WorkflowExecutionResponse> {
    const definition = await this.entityManager.findOne(WorkflowDefinition, {
      where: { id } as any,
    });

    return this.enqueueDefinition(definition, request);
  }

  async executeDefinitionByKey(
    key: string,
    request: WorkflowExecutionRequest,
  ): Promise<WorkflowExecutionResponse> {
    const definition = await this.entityManager.findOne(WorkflowDefinition, {
      where: { key } as any,
    });

    return this.executeDefinition(definition, request);
  }

  async executeDefinitionByKeyAsync(
    key: string,
    request: WorkflowExecutionRequest = {},
  ): Promise<WorkflowExecutionResponse> {
    const definition = await this.entityManager.findOne(WorkflowDefinition, {
      where: { key } as any,
    });

    return this.enqueueDefinition(definition, request);
  }

  private async queueWorkflowExecution(
    payload: WorkflowExecutionQueuePayload,
  ): Promise<string> {
    const messageId = await this.workflowExecutionPublisherFactory.publish(
      {
        payload,
        parentEntityId: payload.executionId,
        parentEntity: 'workflowExecution',
        retryCount: 0,
        retryInterval: 1000,
      },
      'WorkflowExecutionPublisher',
    );

    this.logger.log(
      `Queued workflow execution message ${messageId} for execution id ${payload.executionId}.`,
    );

    return messageId;
  }

  private async enqueueDefinition(
    definition: WorkflowDefinition | null,
    request: WorkflowExecutionRequest,
  ): Promise<WorkflowExecutionResponse> {
    if (!definition) {
      throw new BadRequestException('Workflow definition not found.');
    }

    this.validator.validate(this.assertDefinitionYaml(definition.definitionYaml));
    const execution = await this.writer.createEnqueuedExecution(definition, request);
    await this.queueWorkflowExecution({
      executionId: execution.id,
    });

    return this.toResponse(execution);
  }

  async executeEnqueuedExecution(
    executionId: number,
  ): Promise<WorkflowExecutionResponse> {
    const execution = await this.entityManager.findOne(WorkflowExecution, {
      where: { id: executionId } as any,
      relations: ['workflowDefinition'],
    });

    if (!execution) {
      throw new NotFoundException(`Workflow execution ${executionId} not found.`);
    }

    if (execution.status !== 'enqueued') {
      throw new BadRequestException(
        `Workflow execution ${executionId} is ${execution.status}; expected enqueued.`,
      );
    }

    const request = this.readEnqueuedExecutionRequest(execution);
    return this.executeDefinition(execution.workflowDefinition, request, execution);
  }

  private async executeDefinition(
    definition: WorkflowDefinition | null,
    request: WorkflowExecutionRequest,
    existingExecution?: WorkflowExecution,
  ): Promise<WorkflowExecutionResponse> {
    if (!definition) {
      throw new BadRequestException('Workflow definition not found.');
    }

    const definitionDsl = this.assertDefinitionYaml(definition.definitionYaml);
    this.validator.validate(definitionDsl);
    const secrets = await this.workflowSecretService.getWorkflowSecretsContext();
    const input = this.resolveWorkflowInput(definitionDsl, request, secrets);
    const variables = this.resolveWorkflowVariables(definitionDsl, request, input, secrets);
    const effectiveRequest: WorkflowExecutionRequest = {
      ...request,
      input,
      variables,
    };
    const execution = existingExecution
      ? await this.writer.startExecution(existingExecution, effectiveRequest)
      : await this.writer.createExecution(definition, effectiveRequest);
    const nodeCount = this.countNodes(definitionDsl.nodes);
    const outputs: Record<string, any> = {};
    const runtimeContext: WorkflowRuntimeContext = {
      execution,
      input,
      variables,
      secrets,
      outputs,
      counters: {
        step: 0,
        log: 0,
      },
    };

    try {
      this.logger.log(
        `Starting workflow execution ${execution.executionIdentifier} for ${definition.key} with ${nodeCount} node(s).`,
      );
      await this.writer.writeLog(execution, undefined, {
        level: 'info',
        eventType: 'execution.started',
        message: `Workflow execution started for ${definition.key}.`,
        metadata: {
          executionIdentifier: execution.executionIdentifier,
          workflowKey: definition.key,
          triggerType: execution.triggerType,
          nodeCount,
          inputKeys: Object.keys(runtimeContext.input ?? {}),
          variableKeys: Object.keys(runtimeContext.variables ?? {}),
        },
      }, this.nextLogSequence(runtimeContext));

      await this.runNodes(definitionDsl.nodes, runtimeContext);

      const completed = await this.writer.completeExecution(execution, outputs);

      this.logger.log(
        `Completed workflow execution ${completed.executionIdentifier} for ${definition.key} in ${completed.durationMs ?? 0} ms.`,
      );
      await this.writer.writeLog(completed, undefined, {
        level: 'info',
        eventType: 'execution.completed',
        message: `Workflow execution completed for ${definition.key}.`,
        metadata: {
          executionIdentifier: completed.executionIdentifier,
          durationMs: completed.durationMs,
          outputNodeIds: Object.keys(outputs),
        },
      }, this.nextLogSequence(runtimeContext));

      return this.toResponse(completed);
    } catch (error) {
      const failed = await this.writer.failExecution(execution, error);

      this.logger.error(
        `Failed workflow execution ${failed.executionIdentifier} for ${definition.key}: ${failed.errorSummary}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.writer.writeLog(failed, undefined, {
        level: 'error',
        eventType: 'execution.failed',
        message: failed.errorSummary,
        context: this.summarizeError(error),
        metadata: {
          executionIdentifier: failed.executionIdentifier,
          durationMs: failed.durationMs,
        },
      }, this.nextLogSequence(runtimeContext));

      return this.toResponse(failed);
    }
  }

  async getExecutionStatus(executionId: number): Promise<WorkflowExecutionResponse> {
    const execution = await this.findExecutionOrThrow(executionId);
    return this.toResponse(execution);
  }

  async getLastStepOutput(executionId: number): Promise<any> {
    await this.findExecutionOrThrow(executionId);
    const step = await this.entityManager.findOne(WorkflowStepExecution, {
      where: { workflowExecution: { id: executionId } } as any,
      order: {
        sequenceNumber: 'DESC',
        id: 'DESC',
      } as any,
    });

    if (!step) {
      throw new NotFoundException(`No step executions found for workflow execution ${executionId}.`);
    }

    return this.toStepOutputResponse(step);
  }

  async getStepOutput(
    executionId: number,
    stepNameOrId: string,
    options: { latest?: boolean; limit?: number; offset?: number } = {},
  ): Promise<any> {
    await this.findExecutionOrThrow(executionId);

    const qb = this.entityManager
      .createQueryBuilder(WorkflowStepExecution, 'step')
      .innerJoin('step.workflowExecution', 'execution')
      .where('execution.id = :executionId', { executionId })
      .andWhere(
        '(step.nodeId = :stepNameOrId OR step.nodeName = :stepNameOrId OR step.stepExecutionKey = :stepNameOrId)',
        { stepNameOrId },
      )
      .orderBy('step.sequenceNumber', options.latest === false ? 'ASC' : 'DESC')
      .addOrderBy('step.id', options.latest === false ? 'ASC' : 'DESC');

    if (options.latest !== false && options.limit === undefined && options.offset === undefined) {
      const step = await qb.getOne();
      if (!step) {
        throw new NotFoundException(
          `No step output found for '${stepNameOrId}' in workflow execution ${executionId}.`,
        );
      }
      return this.toStepOutputResponse(step);
    }

    const limit = Math.max(1, Math.min(Number(options.limit ?? 50), 200));
    const offset = Math.max(0, Number(options.offset ?? 0));
    const [steps, totalRecords] = await qb.limit(limit).offset(offset).getManyAndCount();

    return {
      meta: this.buildPagedMeta(offset, limit, totalRecords),
      records: steps.map((step) => this.toStepOutputResponse(step)),
    };
  }

  private resolveWorkflowInput(
    definitionDsl: WorkflowDefinitionDsl,
    request: WorkflowExecutionRequest,
    secrets: Record<string, any>,
  ): Record<string, any> {
    const requestedInput = request.input ?? {};
    const defaultInput = Object.entries(definitionDsl.inputs ?? {}).reduce(
      (acc, [key, inputDefinition]) => {
        if (
          inputDefinition &&
          typeof inputDefinition === 'object' &&
          !Array.isArray(inputDefinition) &&
          Object.prototype.hasOwnProperty.call(inputDefinition, 'default')
        ) {
          acc[key] = inputDefinition.default;
          return acc;
        }

        if (
          inputDefinition === null ||
          inputDefinition === undefined ||
          (typeof inputDefinition === 'object' && !Array.isArray(inputDefinition))
        ) {
          return acc;
        }

        acc[key] = inputDefinition;
        return acc;
      },
      {} as Record<string, any>,
    );
    const rawInput = {
      ...defaultInput,
      ...requestedInput,
    };

    return this.expression.interpolate(rawInput, {
      execution: undefined as any,
      input: rawInput,
      variables: definitionDsl.variables ?? {},
      secrets,
      outputs: {},
    });
  }

  private resolveWorkflowVariables(
    definitionDsl: WorkflowDefinitionDsl,
    request: WorkflowExecutionRequest,
    input: Record<string, any>,
    secrets: Record<string, any>,
  ): Record<string, any> {
    const rawVariables = {
      ...(definitionDsl.variables ?? {}),
      ...(request.variables ?? {}),
    };

    return this.expression.interpolate(rawVariables, {
      execution: undefined as any,
      input,
      variables: rawVariables,
      secrets,
      outputs: {},
    });
  }

  private async runNodes(
    nodes: WorkflowNodeDefinition[],
    context: WorkflowRuntimeContext,
  ): Promise<Record<string, any>> {
    for (const node of nodes ?? []) {
      await this.runNode(node, context);
    }

    return context.outputs;
  }

  private async runNode(
    node: WorkflowNodeDefinition,
    context: WorkflowRuntimeContext,
  ): Promise<void> {
    const inputPayload = {
      configuration: node.configuration,
      input: context.input,
      variables: context.variables,
      item: context.item,
      index: context.index,
    };

    const step = await this.writer.createStep(
      context.execution,
      node,
      this.nextStepSequence(context),
      inputPayload,
      context.parentNodeId,
      context.parentStepExecutionKey,
    );

    if (node.disabled) {
      context.outputs[node.id] = { skipped: true };
      await this.writer.completeStep(step, 'skipped', context.outputs[node.id]);
      await this.writer.writeLog(context.execution, step, {
        level: 'debug',
        eventType: 'node.skipped',
        message: `Skipped disabled node ${node.id}.`,
        metadata: this.nodeLogMetadata(node, context, step),
      }, this.nextLogSequence(context));
      return;
    }

    try {
      await this.writer.writeLog(context.execution, step, {
        level: 'debug',
        eventType: 'node.started',
        message: `Starting node ${node.id} (${node.type}).`,
        metadata: this.nodeLogMetadata(node, context, step),
      }, this.nextLogSequence(context));

      this.logger.debug(
        `Starting workflow node ${node.id} (${node.type}) for execution ${context.execution.executionIdentifier}.`,
      );
      const startedAtMs = Date.now();
      const handler = this.registry.get(node.type);
      const result = await handler.execute({
        ...context,
        node,
        stepExecution: step,
        expression: this.expression,
        runNodes: async (childNodes, options = {}) =>
          this.runNodes(childNodes, {
            ...context,
            ...options,
            execution: context.execution,
            outputs: options.outputs ?? context.outputs,
            parentNodeId: node.id,
            parentStepExecutionKey: step.stepExecutionKey,
          }),
        emitLog: async (entry) => {
          await this.writer.writeLog(
            context.execution,
            step,
            entry,
            this.nextLogSequence(context),
          );
        },
        emitArtifact: async (entry) => {
          await this.writer.writeArtifact(context.execution, step, entry);
        },
      });

      const output = result.output ?? {};
      context.outputs[node.id] = output;

      for (const artifact of result.artifacts ?? []) {
        await this.writer.writeArtifact(context.execution, step, artifact);
      }

      await this.writer.completeStep(
        step,
        result.status ?? 'success',
        output,
        {
          item: context.item,
          index: context.index,
        },
      );

      await this.writer.writeLog(context.execution, step, {
        level: 'debug',
        eventType: 'node.completed',
        message: `Completed node ${node.id} (${node.type}).`,
        metadata: {
          ...this.nodeLogMetadata(node, context, step),
          status: result.status ?? 'success',
          durationMs: Date.now() - startedAtMs,
          outputSummary: this.summarizeValue(output),
          artifactCount: result.artifacts?.length ?? 0,
        },
      }, this.nextLogSequence(context));
    } catch (error) {
      await this.writer.failStep(step, error);

      if (node.onError === 'continue') {
        context.outputs[node.id] = {
          error: error instanceof Error ? error.message : String(error),
        };
        await this.writer.writeLog(context.execution, step, {
          level: 'warn',
          eventType: 'node.failed.continued',
          message: `Node ${node.id} failed but workflow continued: ${this.errorMessage(error)}.`,
          context: this.summarizeError(error),
          metadata: this.nodeLogMetadata(node, context, step),
        }, this.nextLogSequence(context));
        return;
      }

      await this.writer.writeLog(context.execution, step, {
        level: 'error',
        eventType: 'node.failed',
        message: `Node ${node.id} failed: ${this.errorMessage(error)}.`,
        context: this.summarizeError(error),
        metadata: this.nodeLogMetadata(node, context, step),
      }, this.nextLogSequence(context));
      throw error;
    }
  }

  private assertDefinitionYaml(value: any): WorkflowDefinitionDsl {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException(
        'Workflow definition YAML must be stored as a string.',
      );
    }

    let parsed: unknown;
    try {
      parsed = YAML.parse(value);
    } catch (error: any) {
      throw new BadRequestException(
        error?.message ?? 'Workflow definition YAML could not be parsed.',
      );
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestException(
        'Workflow definition YAML must resolve to an object with a nodes array.',
      );
    }

    if (!Array.isArray((parsed as WorkflowDefinitionDsl).nodes)) {
      throw new BadRequestException(
        'Workflow definition YAML must include a nodes array.',
      );
    }

    return parsed as WorkflowDefinitionDsl;
  }

  private readEnqueuedExecutionRequest(execution: WorkflowExecution): WorkflowExecutionRequest {
    const payload = execution.inputPayload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {
        triggerType: execution.triggerType,
        requestedByUserId: execution.requestedByUserId as any,
      };
    }

    return {
      ...(payload as WorkflowExecutionRequest),
      triggerType: (payload as WorkflowExecutionRequest).triggerType ?? execution.triggerType,
      requestedByUserId:
        (payload as WorkflowExecutionRequest).requestedByUserId ??
        (execution.requestedByUserId as any),
    };
  }

  private async findExecutionOrThrow(executionId: number): Promise<WorkflowExecution> {
    const execution = await this.entityManager.findOne(WorkflowExecution, {
      where: { id: executionId } as any,
    });

    if (!execution) {
      throw new NotFoundException(`Workflow execution ${executionId} not found.`);
    }

    return execution;
  }

  private toStepOutputResponse(step: WorkflowStepExecution) {
    return {
      id: step.id,
      stepExecutionKey: step.stepExecutionKey,
      nodeId: step.nodeId,
      nodeName: step.nodeName,
      nodeType: step.nodeType,
      nodeKind: step.nodeKind,
      sequenceNumber: step.sequenceNumber,
      attemptNumber: step.attemptNumber,
      status: step.status,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      durationMs: step.durationMs as any,
      runtimeContext: step.runtimeContext,
      outputPayload: step.outputPayload,
      errorSummary: step.errorSummary,
    };
  }

  private buildPagedMeta(offset: number, limit: number, totalRecords: number) {
    const currentPage = limit ? Math.floor(offset / limit) + 1 : 1;
    const totalPages = limit ? Math.max(1, Math.ceil(totalRecords / limit)) : 1;
    return {
      totalRecords,
      currentPage,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      prevPage: currentPage > 1 ? currentPage - 1 : null,
      totalPages,
      perPage: limit,
    };
  }

  private toResponse(execution: WorkflowExecution): WorkflowExecutionResponse {
    return {
      id: execution.id,
      executionIdentifier: execution.executionIdentifier,
      workflowKey: execution.workflowKey,
      status: execution.status as any,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt,
      durationMs: execution.durationMs as any,
      outputPayload: execution.outputPayload,
      errorSummary: execution.errorSummary,
    };
  }

  private nextStepSequence(context: WorkflowRuntimeContext): number {
    context.counters = context.counters ?? { step: 0, log: 0 };
    context.counters.step += 1;
    return context.counters.step;
  }

  private nextLogSequence(context: WorkflowRuntimeContext): number {
    context.counters = context.counters ?? { step: 0, log: 0 };
    context.counters.log += 1;
    return context.counters.log;
  }

  private countNodes(nodes: WorkflowNodeDefinition[] = []): number {
    return nodes.reduce((count, node) => {
      const nestedNodes = [
        ...(node.tasks ?? []),
        ...(node.then ?? []),
        ...(node.else ?? []),
        ...(node.defaults ?? []),
        ...Object.values(node.cases ?? {}).flat(),
      ];

      return count + 1 + this.countNodes(nestedNodes);
    }, 0);
  }

  private nodeLogMetadata(
    node: WorkflowNodeDefinition,
    context: WorkflowRuntimeContext,
    step?: WorkflowStepExecution,
  ) {
    return {
      executionIdentifier: context.execution.executionIdentifier,
      stepExecutionKey: step?.stepExecutionKey,
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      nodeKind: node.kind,
      parentNodeId: context.parentNodeId,
      parentStepExecutionKey: context.parentStepExecutionKey,
      index: context.index,
      hasItem: context.item !== undefined,
      configurationKeys:
        node.configuration && typeof node.configuration === 'object'
          ? Object.keys(node.configuration)
          : [],
      availableInputKeys: Object.keys(context.input ?? {}),
      availableVariableKeys: Object.keys(context.variables ?? {}),
      availableOutputNodeIds: Object.keys(context.outputs ?? {}),
    };
  }

  private summarizeValue(value: any): any {
    if (Array.isArray(value)) {
      return {
        type: 'array',
        length: value.length,
      };
    }

    if (value && typeof value === 'object') {
      return {
        type: 'object',
        keys: Object.keys(value),
      };
    }

    return {
      type: value === null ? 'null' : typeof value,
      empty: value === undefined || value === null || value === '',
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private summarizeError(error: unknown): any {
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
