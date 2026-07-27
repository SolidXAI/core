import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';

@WorkflowNodeProvider({
  type: 'sequential',
  kind: 'control',
  category: 'control-flow',
  label: 'Sequential',
  description: 'Runs child tasks in order and returns their outputs.',
  tags: ['sequential', 'flowable', 'ordered'],
  authoring: {
    defaultConfiguration: {},
    childSlots: [
      {
        key: 'tasks',
        label: 'Tasks',
        description: 'Child tasks that run one after another.',
        kind: 'sequence',
        layout: 'sequential',
        required: true,
      },
      {
        key: 'errors',
        label: 'Errors',
        description: 'Nodes that run sequentially if this sequence fails.',
        kind: 'sequence',
        layout: 'sequential',
      },
    ],
    supportsDescription: true,
    supportsName: true,
  },
  documentation: {
    summary: 'Runs child tasks one after another in the order they are defined.',
  },
  ui: {
    icon: 'si-list-numbers',
    iconColor: '#0891b2',
    iconBackgroundColor: '#cffafe',
    iconBorderColor: '#a5f3fc',
    modalSize: 'lg',
  },
})
export class SequentialNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const childTasks = context.node.tasks ?? [];
    const outputs = {};

    await context.runNodes(childTasks, {
      outputs,
    });

    return {
      output: {
        tasks: outputs,
      },
    };
  }
}
