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
})
export class ForEachNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.node.configuration ?? {};
    const items = context.expression.interpolate(configuration.items ?? [], context);

    if (!Array.isArray(items)) {
      throw new BadRequestException('forEach requires configuration.items array.');
    }

    const childNodes = context.node.children ?? context.node.nodes ?? [];
    const iterations = [];

    for (let index = 0; index < items.length; index++) {
      const iterationOutputs = {};

      await context.runNodes(childNodes, {
        item: items[index],
        index,
        outputs: iterationOutputs,
      });

      iterations.push({
        index,
        item: items[index],
        outputs: iterationOutputs,
      });
    }

    return {
      output: {
        count: items.length,
        iterations,
      },
    };
  }
}
