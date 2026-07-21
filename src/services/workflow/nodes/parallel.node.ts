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
        const outputs = {};

        await context.runNodes([task], {
          outputs,
        });

        return {
          id: task.id,
          name: task.name,
          outputs,
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
