import { BadRequestException } from '@nestjs/common';
import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';

@WorkflowNodeProvider({
  type: 'execution.fail',
  kind: 'task',
  version: '1.0.0',
  category: 'core',
  subcategory: 'execution',
  label: 'Fail Execution',
  description: 'Fails intentionally with a configured message.',
  tags: ['failure', 'error', 'testing'],
  aliases: ['fail'],
  configSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        default: 'Execution failed intentionally.',
      },
    },
  },
  authoring: {
    defaultConfiguration: {
      message: 'Execution failed intentionally.',
    },
    configurationFields: [
      {
        key: 'message',
        label: 'Message',
        description: 'Failure message. Expressions are allowed.',
        valueType: 'string',
        expressionAllowed: true,
        group: 'General',
      },
    ],
    supportsExpressions: true,
    supportsDisableToggle: true,
    supportsName: true,
    supportsDescription: true,
    searchableText: ['fail', 'failure', 'error', 'testing'],
  },
  runtime: {
    emitsLogs: false,
    emitsArtifacts: false,
    deterministicOutputs: true,
    executionMode: 'task',
    successStatuses: [],
  },
  documentation: {
    summary:
      'Use this node in reference workflows and tests to intentionally exercise failure paths and error handlers.',
  },
  ui: {
    icon: 'si-x-circle',
    iconColor: '#dc2626',
    iconBackgroundColor: '#fee2e2',
    iconBorderColor: '#fecaca',
    modalSize: 'lg',
    layoutHints: {
      groupOrder: ['General'],
    },
  },
})
export class ExecutionFailNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.expression.interpolate(
      context.node.configuration ?? {},
      context,
    );
    throw new BadRequestException(
      configuration.message ?? 'Execution failed intentionally.',
    );
  }
}
