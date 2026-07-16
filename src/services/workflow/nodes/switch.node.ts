import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeDefinition,
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';

@WorkflowNodeProvider({
  type: 'switch',
  kind: 'control',
  category: 'control-flow',
  label: 'Switch',
  description:
    'Runs one case sequence based on a contextual value, with an optional default sequence.',
  tags: ['switch', 'case', 'branching', 'condition'],
  authoring: {
    defaultConfiguration: {
      value: '{{ input.value }}',
    },
    configurationFields: [
      {
        key: 'value',
        label: 'Value',
        description:
          'Expression or literal value used to choose the matching case key.',
        valueType: 'expression',
        required: true,
        expressionAllowed: true,
        widgetHint: 'textarea',
        group: 'General',
      },
    ],
    childSlots: [
      {
        key: 'cases',
        label: 'Cases',
        description: 'Named case sequences. The matching case key is executed.',
        kind: 'case-collection',
        required: true,
        minItems: 1,
      },
      {
        key: 'defaults',
        label: 'Default',
        description:
          'Fallback sequence that runs when no case key matches the resolved value.',
        kind: 'sequence',
      },
    ],
    supportsDescription: true,
    supportsName: true,
  },
  documentation: {
    summary:
      'Evaluates a contextual value and runs the child node sequence under the matching case key. If no case matches, the optional default sequence runs.',
  },
  ui: {
    icon: 'si-git-branch',
    modalSize: 'lg',
    layoutHints: {
      groupOrder: ['General'],
    },
  },
})
export class SwitchNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.node.configuration ?? {};
    const resolvedValue = context.expression.interpolate(
      configuration.value,
      context,
    );
    const caseKey = this.resolveCaseKey(resolvedValue, context.node.cases ?? {});
    const selectedNodes = caseKey
      ? context.node.cases?.[caseKey] ?? []
      : context.node.defaults ?? [];

    await context.emitLog({
      level: 'info',
      eventType: 'node.switch.evaluated',
      source: 'switch',
      message: caseKey
        ? `Switch node "${context.node.id}" matched case "${caseKey}".`
        : `Switch node "${context.node.id}" did not match a case and will run defaults.`,
      context: {
        value: resolvedValue,
        caseKey,
      },
    });

    await context.runNodes(selectedNodes);

    return {
      output: {
        value: resolvedValue,
        case: caseKey,
        matched: Boolean(caseKey),
      },
    };
  }

  private resolveCaseKey(
    value: any,
    cases: Record<string, WorkflowNodeDefinition[]>,
  ): string | undefined {
    const exactKey = String(value);
    if (Object.prototype.hasOwnProperty.call(cases, exactKey)) {
      return exactKey;
    }

    if (typeof value === 'boolean') {
      const booleanKey = value ? 'true' : 'false';
      if (Object.prototype.hasOwnProperty.call(cases, booleanKey)) {
        return booleanKey;
      }
    }

    return undefined;
  }
}
