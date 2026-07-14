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
  description: 'Runs multiple branches concurrently and returns branch outputs.',
  tags: ['parallel', 'branching'],
  authoring: {
    defaultConfiguration: {},
    childSlots: [
      {
        key: 'branches',
        label: 'Branches',
        description: 'Each branch owns its own node sequence and runs concurrently.',
        kind: 'branch-collection',
        required: true,
        minItems: 2,
      },
    ],
    supportsDescription: true,
    supportsName: true,
  },
  documentation: {
    summary: 'Runs named branches concurrently and returns their outputs.',
  },
  ui: {
    icon: 'si-objects-column',
    modalSize: 'lg',
  },
})
export class ParallelNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const branches =
      context.node.branches ??
      (context.node.children
        ? [{ id: 'default', name: 'Default', nodes: context.node.children }]
        : []);

    const branchResults = await Promise.all(
      branches.map(async (branch) => {
        const outputs = {};

        await context.runNodes(branch.nodes ?? [], {
          outputs,
        });

        return {
          id: branch.id,
          name: branch.name,
          outputs,
        };
      }),
    );

    return {
      output: {
        branches: branchResults,
      },
    };
  }
}
