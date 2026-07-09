import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowExecution } from '../../entities/workflow-execution.entity';
import { WorkflowStepExecution } from '../../entities/workflow-step-execution.entity';
import {
  WorkflowDefinitionJson,
  WorkflowExecutionRequest,
  WorkflowExecutionResponse,
  WorkflowNodeDefinition,
  WorkflowRuntimeContext,
} from '../../types/workflow-dsl.types';
import { WorkflowExecutionWriterService } from './workflow-execution-writer.service';
import { WorkflowExpressionService } from './workflow-expression.service';
import { WorkflowDefinitionValidatorService } from './workflow-definition-validator.service';
import { WorkflowNodeRegistryService } from './workflow-node-registry.service';

@Injectable()
export class WorkflowRuntimeService {
  constructor(
    @InjectEntityManager('default')
    private readonly entityManager: EntityManager,
    private readonly registry: WorkflowNodeRegistryService,
    private readonly expression: WorkflowExpressionService,
    private readonly writer: WorkflowExecutionWriterService,
    private readonly validator: WorkflowDefinitionValidatorService,
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

  async executeDefinitionByKey(
    key: string,
    request: WorkflowExecutionRequest,
  ): Promise<WorkflowExecutionResponse> {
    const definition = await this.entityManager.findOne(WorkflowDefinition, {
      where: { key } as any,
    });

    return this.executeDefinition(definition, request);
  }

  private async executeDefinition(
    definition: WorkflowDefinition | null,
    request: WorkflowExecutionRequest,
  ): Promise<WorkflowExecutionResponse> {
    if (!definition) {
      throw new BadRequestException('Workflow definition not found.');
    }

    const definitionJson = this.assertDefinitionJson(definition.definitionJson);
    this.validator.validate(definitionJson);
    const execution = await this.writer.createExecution(definition, request);
    const outputs: Record<string, any> = {};
    const runtimeContext: WorkflowRuntimeContext = {
      execution,
      input: request.input ?? {},
      variables: {
        ...(definitionJson.variables ?? {}),
        ...(request.variables ?? {}),
      },
      outputs,
      counters: {
        step: 0,
        log: 0,
      },
    };

    try {
      await this.writer.writeLog(execution, undefined, {
        level: 'info',
        eventType: 'execution.started',
        message: `Workflow execution started for ${definition.key}.`,
      }, this.nextLogSequence(runtimeContext));

      await this.runNodes(definitionJson.nodes, runtimeContext);

      const completed = await this.writer.completeExecution(execution, outputs);

      await this.writer.writeLog(completed, undefined, {
        level: 'info',
        eventType: 'execution.completed',
        message: `Workflow execution completed for ${definition.key}.`,
      }, this.nextLogSequence(runtimeContext));

      return this.toResponse(completed);
    } catch (error) {
      const failed = await this.writer.failExecution(execution, error);

      await this.writer.writeLog(failed, undefined, {
        level: 'error',
        eventType: 'execution.failed',
        message: failed.errorSummary,
        context: failed.errorDetails,
      }, this.nextLogSequence(runtimeContext));

      return this.toResponse(failed);
    }
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
      return;
    }

    try {
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
    } catch (error) {
      await this.writer.failStep(step, error);

      if (node.onError === 'continue') {
        context.outputs[node.id] = {
          error: error instanceof Error ? error.message : String(error),
        };
        return;
      }

      throw error;
    }
  }

  private assertDefinitionJson(value: any): WorkflowDefinitionJson {
    if (!value || !Array.isArray(value.nodes)) {
      throw new BadRequestException(
        'Workflow definition JSON must include a nodes array.',
      );
    }

    return value;
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
}
