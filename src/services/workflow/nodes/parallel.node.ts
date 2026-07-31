import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';

@WorkflowNodeProvider({
  type: 'parallel',
  kind: 'control',
  category: 'control-flow',
  label: 'Parallel',
  description: 'Runs child tasks concurrently and returns task outputs.',
  tags: ['parallel', 'concurrency'],
  authoring: {
    defaultConfiguration: {},
    childSlots: [
      {
        key: 'tasks',
        label: 'Tasks',
        description: 'Child tasks that run concurrently.',
        kind: 'sequence',
        layout: 'parallel',
        required: true,
      },
      {
        key: 'errors',
        label: 'Errors',
        description: 'Nodes that run sequentially if this parallel branch fails.',
        kind: 'sequence',
        layout: 'sequential',
      },
    ],
    supportsDescription: true,
    supportsName: true,
  },
  documentation: {
    summary: 'Runs child tasks concurrently and returns their outputs.',
  },
  ui: {
    icon: 'si-objects-column',
    iconColor: '#2563eb',
    iconBackgroundColor: '#dbeafe',
    iconBorderColor: '#bfdbfe',
    modalSize: 'lg',
  },
})
export class ParallelNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const childTasks = context.node.tasks ?? [];

    const taskResults = await Promise.all(
      childTasks.map(async (task) => {
        const inheritedOutputs = context.outputs ?? {};
        const inheritedOutputKeys = new Set(Object.keys(inheritedOutputs));
        const outputs = { ...inheritedOutputs };

        await context.runNodes([task], {
          outputs,
        });

        const branchOutputs = Object.entries(outputs).reduce(
          (acc, [key, value]) => {
            if (!inheritedOutputKeys.has(key)) {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, any>,
        );

        return {
          id: task.id,
          name: task.name,
          outputs: branchOutputs,
        };
      }),
    );

    return {
      output: {
        tasks: taskResults,
      },
    };
  }
}
