import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';

@WorkflowNodeProvider({
  type: 'log.write',
  kind: 'task',
  version: '1.0.0',
  category: 'core',
  subcategory: 'observability',
  label: 'Write Log',
  description: 'Writes an execution log entry and returns the rendered message.',
  tags: ['log', 'debug', 'observability'],
  aliases: ['log'],
  configSchema: {
    type: 'object',
    required: ['message'],
    properties: {
      level: {
        type: 'string',
        enum: ['debug', 'info', 'warn', 'error'],
        default: 'info',
      },
      message: {
        type: 'string',
      },
      context: {
        type: 'object',
        default: {},
      },
      metadata: {
        type: 'object',
        default: {},
      },
    },
  },
  uiSchema: {
    'ui:order': ['level', 'message', 'context', 'metadata'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      level: { type: 'string' },
      message: { type: 'string' },
    },
  },
  examples: [
    {
      key: 'simple-message',
      label: 'Simple log message',
      description: 'Write a simple interpolated log line.',
      language: 'yaml',
      snippet:
        'message: "Hello {{ input.name }}"\nlevel: info\n',
      configurationOnly: true,
    },
  ],
  metrics: [
    {
      key: 'workflow.node.log.count',
      label: 'Log writes',
      description: 'Counts how many times the log node executes.',
      type: 'counter',
      tags: ['log', 'workflow'],
    },
  ],
  definitions: [
    {
      key: 'log-levels',
      label: 'Supported log levels',
      content:
        'The node supports debug, info, warn, and error. The chosen level is stored alongside the log message.',
    },
  ],
  authoring: {
    defaultConfiguration: {
      level: 'info',
      context: {},
      metadata: {},
    },
    configurationFields: [
      {
        key: 'level',
        label: 'Level',
        description: 'The severity used for the emitted workflow log entry.',
        valueType: 'string',
        defaultValue: 'info',
        enumValues: ['debug', 'info', 'warn', 'error'],
        group: 'Message',
      },
      {
        key: 'message',
        label: 'Message',
        description: 'The text to log. Expressions are allowed.',
        valueType: 'string',
        required: true,
        expressionAllowed: true,
        group: 'Message',
      },
      {
        key: 'context',
        label: 'Context',
        description: 'Optional structured context attached to the log entry.',
        valueType: 'object',
        expressionAllowed: true,
        group: 'Advanced',
        widgetHint: 'yaml-editor',
      },
      {
        key: 'metadata',
        label: 'Metadata',
        description: 'Optional metadata attached to the log entry.',
        valueType: 'object',
        expressionAllowed: true,
        group: 'Advanced',
        widgetHint: 'yaml-editor',
      },
    ],
    outputs: [
      {
        key: 'level',
        label: 'Level',
        description: 'The resolved log level.',
        valueType: 'string',
        path: 'level',
      },
      {
        key: 'message',
        label: 'Message',
        description: 'The rendered log message.',
        valueType: 'string',
        path: 'message',
      },
    ],
    supportsExpressions: true,
    supportsDisableToggle: true,
    supportsName: true,
    supportsDescription: true,
    searchableText: ['log', 'message', 'debug', 'observability'],
  },
  runtime: {
    emitsLogs: true,
    emitsArtifacts: false,
    deterministicOutputs: true,
    executionMode: 'task',
    successStatuses: ['success'],
  },
  documentation: {
    summary:
      'Use this node for debug messages, execution breadcrumbs, and quick expression verification.',
  },
  ui: {
    icon: 'si-file',
    defaultEditorMode: 'schema',
    modalSize: 'lg',
    layoutHints: {
      preferredPanel: 'flow',
      groupOrder: ['Message', 'Advanced'],
      stickySummary: true,
    },
  },
})
export class LogWriteNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.expression.interpolate(
      context.node.configuration ?? {},
      context,
    );
    const level = configuration.level ?? 'info';
    const message = configuration.message ?? context.node.name ?? context.node.id;

    await context.emitLog({
      level,
      message,
      eventType: 'node.log',
      source: 'log.write',
      context: configuration.context,
      metadata: configuration.metadata,
    });

    return {
      output: {
        level,
        message,
      },
    };
  }
}
