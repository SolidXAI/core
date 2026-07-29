import { BadRequestException } from '@nestjs/common';
import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';

@WorkflowNodeProvider({
  type: 'forEach',
  kind: 'control',
  category: 'control-flow',
  label: 'For Each',
  description: 'Runs child nodes once for every item in an array.',
  tags: ['loop', 'iteration'],
  authoring: {
    defaultConfiguration: {
      items: '',
      concurrencyLimit: 1,
      aggregateOutputs: false,
    },
    configurationFields: [
      {
        key: 'items',
        label: 'Items',
        description: 'Array or expression resolving to an array to iterate over.',
        valueType: 'string',
        required: true,
        expressionAllowed: true,
        group: 'General',
        uiSchema: {
          layout: {
            width: 'full',
          },
        },
      },
      {
        key: 'concurrencyLimit',
        label: 'Concurrency Limit',
        description:
          'Maximum number of loop iterations to run at once. Use 1 for sequential execution and 0 for unlimited concurrency.',
        valueType: 'number',
        defaultValue: 1,
        expressionAllowed: true,
        group: 'General',
      },
      {
        key: 'aggregateOutputs',
        label: 'Aggregate Outputs',
        description:
          'Adds per-iteration child outputs to this forEach node output for downstream expressions.',
        valueType: 'boolean',
        defaultValue: false,
        expressionAllowed: true,
        group: 'General',
      },
      {
        key: 'outputKey',
        label: 'Output Key',
        description:
          'Optional expression used as the per-iteration key when aggregate outputs is enabled.',
        valueType: 'string',
        expressionAllowed: true,
        group: 'General',
      },
    ],
    childSlots: [
      {
        key: 'tasks',
        label: 'Loop Body',
        description: 'Nodes that run once for each item.',
        kind: 'sequence',
        layout: 'sequential',
        required: true,
      },
      {
        key: 'errors',
        label: 'Errors',
        description: 'Nodes that run sequentially if this loop fails.',
        kind: 'sequence',
        layout: 'sequential',
      },
    ],
    supportsDescription: true,
    supportsName: true,
  },
  documentation: {
    summary: 'Iterates over an array and runs the loop body once for each item.',
  },
  ui: {
    icon: 'si-refresh',
    iconColor: '#7c3aed',
    iconBackgroundColor: '#f3e8ff',
    iconBorderColor: '#d8b4fe',
    modalSize: 'lg',
    layoutHints: {
      groupOrder: ['General'],
    },
  },
})
export class ForEachNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.node.configuration ?? {};
    const items = context.expression.interpolate(configuration.items ?? [], context);
    const concurrencyLimit = this.resolveConcurrencyLimit(
      context.expression.interpolate(configuration.concurrencyLimit ?? 1, context),
    );
    const aggregateOutputs = Boolean(
      context.expression.interpolate(configuration.aggregateOutputs ?? false, context),
    );

    if (!Array.isArray(items)) {
      throw new BadRequestException('forEach requires configuration.items array.');
    }

    const childNodes = context.node.tasks ?? [];
    const iterationsByIndex: Record<number, any> = {};
    const iterationsByKey: Record<string, any> = {};
    const shouldAggregateByKey =
      aggregateOutputs && configuration.outputKey !== undefined && configuration.outputKey !== null;

    await this.runIterations(items, concurrencyLimit, async (item, index) => {
      const inheritedOutputs = context.outputs ?? {};
      const iterationOutputs = { ...inheritedOutputs };
      const parentLoops = context.loops ?? [];
      const currentLoop = {
        item,
        index,
        nodeId: context.node.id,
        stepExecutionKey: context.stepExecution.stepExecutionKey,
      };
      const loopContext = {
        item,
        index,
        parent: parentLoops[parentLoops.length - 1],
        parents: [...parentLoops].reverse(),
        loops: [...parentLoops, currentLoop],
      };
      const outputKey = shouldAggregateByKey
        ? String(context.expression.interpolate(configuration.outputKey, {
            ...context,
            ...loopContext,
            outputs: iterationOutputs,
          }))
        : undefined;

      const childOutputs = await context.runNodes(childNodes, {
        ...loopContext,
        outputs: iterationOutputs,
      });

      if (aggregateOutputs) {
        const iterationResult = {
          item,
          index,
          outputs: childOutputs,
        };

        iterationsByIndex[index] = iterationResult;
        if (outputKey !== undefined) {
          iterationsByKey[outputKey] = iterationResult;
        }
      }
    });

    return {
      output: {
        count: items.length,
        childNodeIds: childNodes.map((childNode) => childNode.id),
        concurrencyLimit,
        // Keep the control-node output intentionally small. Per-iteration
        // outputs are already stored on the child workflowStepExecution rows.
        iterationOutputsStoredOnSteps: !aggregateOutputs,
        ...(aggregateOutputs
          ? {
              iterations: {
                byIndex: iterationsByIndex,
                ...(shouldAggregateByKey
                  ? {
                      byKey: iterationsByKey,
                    }
                  : {}),
              },
            }
          : {}),
      },
    };
  }

  private resolveConcurrencyLimit(value: any): number {
    const parsed = Number(value === '' || value === null || value === undefined ? 1 : value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(
        'forEach configuration.concurrencyLimit must be 0 or a positive number.',
      );
    }

    return Math.floor(parsed);
  }

  private async runIterations<T>(
    items: T[],
    concurrencyLimit: number,
    handler: (item: T, index: number) => Promise<void>,
  ): Promise<void> {
    if (concurrencyLimit === 1 || items.length <= 1) {
      for (let index = 0; index < items.length; index++) {
        await handler(items[index], index);
      }
      return;
    }

    const limit = concurrencyLimit === 0 ? items.length : concurrencyLimit;
    let nextIndex = 0;

    const workers = Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (nextIndex < items.length) {
          const index = nextIndex;
          nextIndex += 1;
          await handler(items[index], index);
        }
      },
    );

    await Promise.all(workers);
  }
}
