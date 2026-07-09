import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';

@WorkflowNodeProvider({
  type: 'if',
  kind: 'control',
  category: 'control-flow',
  label: 'If',
  description: 'Runs then or else child nodes based on a boolean expression.',
})
export class IfNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const condition =
      context.node.configuration?.condition ??
      context.node.configuration?.expression;
    const matched = context.expression.evaluateCondition(condition, context);
    const selectedNodes = matched
      ? context.node.then ?? context.node.children ?? []
      : context.node.else ?? [];

    await context.emitLog({
      level: 'info',
      eventType: 'node.if.evaluated',
      source: 'if',
      message: `If node "${context.node.id}" evaluated to ${matched}.`,
      context: { condition },
    });

    await context.runNodes(selectedNodes);

    return {
      output: {
        matched,
        branch: matched ? 'then' : 'else',
      },
    };
  }
}
