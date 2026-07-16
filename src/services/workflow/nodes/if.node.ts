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
  tags: ['branching', 'condition'],
  authoring: {
    defaultConfiguration: {
      condition: '{{ input.shouldContinue === true }}',
    },
    configurationFields: [
      {
        key: 'condition',
        label: 'Condition',
        description: 'Boolean expression evaluated by the workflow expression engine.',
        valueType: 'expression',
        required: true,
        expressionAllowed: true,
        widgetHint: 'textarea',
        group: 'General',
      },
    ],
    childSlots: [
      {
        key: 'then',
        label: 'Then',
        description: 'Nodes that run when the condition evaluates to true.',
        kind: 'sequence',
        required: true,
      },
      {
        key: 'else',
        label: 'Else',
        description: 'Nodes that run when the condition evaluates to false.',
        kind: 'sequence',
      },
    ],
    supportsDescription: true,
    supportsName: true,
  },
  documentation: {
    summary:
      'Conditionally branches workflow execution into then or else node sequences. The node evaluates a boolean expression and executes either the then or else child sequence. Sequence order inside each branch remains implicit by array order.',
  },
  ui: {
    icon: 'si-code',
    modalSize: 'lg',
    layoutHints: {
      groupOrder: ['General'],
    },
  },
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
      ? context.node.then ?? []
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
