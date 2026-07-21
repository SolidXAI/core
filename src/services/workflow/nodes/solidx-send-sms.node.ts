import { BadRequestException } from '@nestjs/common';
import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { SmsFactory } from '../../../factories/sms.factory';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';

const fullWidthField = {
  layout: {
    width: 'full',
  },
};

const jsonEditorField = {
  ...fullWidthField,
  editor: {
    language: 'json',
  },
};

@WorkflowNodeProvider({
  type: 'solidx.sms.send',
  kind: 'task',
  version: '1.0.0',
  category: 'integration',
  subcategory: 'solidx',
  label: 'Send SMS',
  description:
    'Sends an SMS using the native SolidX SMS provider and queue settings.',
  tags: ['solidx', 'sms', 'notification', 'template', 'text-message'],
  aliases: ['sms.send', 'text.send', 'solidx.text.send'],
  configSchema: {
    type: 'object',
    required: ['to', 'mode'],
    properties: {
      mode: {
        type: 'string',
        enum: ['template', 'raw'],
        default: 'template',
      },
      to: {},
      body: { type: 'string' },
      templateName: { type: 'string' },
      templateParams: { type: 'object', default: {} },
      shouldQueueSms: { type: 'boolean', default: true },
      providerName: { type: 'string' },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      mode: { type: 'string' },
      to: {},
      body: { type: 'string' },
      templateName: { type: 'string' },
      queued: { type: 'boolean' },
      providerName: { type: 'string' },
      response: {},
    },
  },
  examples: [
    {
      key: 'template-sms',
      label: 'Template SMS',
      description:
        'Render a SolidX SMS template and queue the message for delivery.',
      language: 'yaml',
      snippet:
        'mode: template\nto: "{{ input.mobile }}"\ntemplateName: workflow-alert\ntemplateParams:\n  name: "{{ input.name }}"\n  reference: "{{ execution.executionIdentifier }}"\nshouldQueueSms: true\n',
      configurationOnly: true,
    },
    {
      key: 'raw-sms',
      label: 'Raw SMS',
      description:
        'Send a direct SMS body. Use only with providers that support raw SMS, such as Twilio.',
      language: 'yaml',
      snippet:
        'mode: raw\nto:\n  - "+15551234567"\nbody: "Workflow {{ execution.executionIdentifier }} completed."\nshouldQueueSms: true\n',
      configurationOnly: true,
    },
  ],
  definitions: [
    {
      key: 'native-sms-provider',
      label: 'Native SolidX SMS provider',
      content:
        'This task resolves the active SolidX SMS provider through SmsFactory, so Twilio, Msg91, or consuming-project providers can be selected by the existing smsProvider setting.',
    },
    {
      key: 'template-first',
      label: 'Template-first delivery',
      content:
        'Some SMS gateways require registered templates and do not support raw text. Template mode is therefore the default, while raw mode remains available for providers that support it.',
    },
    {
      key: 'queueing',
      label: 'Queueing',
      content:
        'shouldQueueSms is passed to the native provider. Providers may still queue based on system settings even when this value is false.',
    },
  ],
  authoring: {
    defaultConfiguration: {
      mode: 'template',
      templateParams: {},
      shouldQueueSms: true,
    },
    configurationFields: [
      {
        key: 'mode',
        label: 'Mode',
        description: 'Send a raw SMS or render a SolidX SMS template.',
        valueType: 'string',
        enumValues: ['template', 'raw'],
        defaultValue: 'template',
        required: true,
        group: 'Message',
        uiSchema: fullWidthField,
      },
      {
        key: 'to',
        label: 'To',
        description:
          'Recipient mobile number, comma-separated list, or array. Expressions are allowed.',
        valueType: 'array',
        required: true,
        expressionAllowed: true,
        group: 'Recipients',
        widgetHint: 'json-editor',
        uiSchema: fullWidthField,
      },
      {
        key: 'templateName',
        label: 'Template Name',
        description:
          'SolidX SMS template name/user key for template mode. Expressions are allowed.',
        valueType: 'string',
        required: true,
        expressionAllowed: true,
        group: 'Template',
        uiSchema: {
          ...fullWidthField,
          visibleWhen: {
            field: 'mode',
            equals: 'template',
          },
        },
      },
      {
        key: 'templateParams',
        label: 'Template Parameters',
        description:
          'JSON parameters used when rendering the SMS template. Expressions are allowed.',
        valueType: 'object',
        expressionAllowed: true,
        group: 'Template',
        widgetHint: 'json-editor',
        uiSchema: {
          ...jsonEditorField,
          visibleWhen: {
            field: 'mode',
            equals: 'template',
          },
        },
      },
      {
        key: 'body',
        label: 'Body',
        description:
          'SMS body for raw mode. Expressions are allowed. Some providers require template mode instead.',
        valueType: 'string',
        required: true,
        expressionAllowed: true,
        group: 'Message',
        widgetHint: 'raw-editor',
        uiSchema: {
          ...fullWidthField,
          visibleWhen: {
            field: 'mode',
            equals: 'raw',
          },
        },
      },
      {
        key: 'shouldQueueSms',
        label: 'Queue SMS',
        description: 'Use the native SolidX SMS queue when available.',
        valueType: 'boolean',
        defaultValue: true,
        group: 'Delivery',
        uiSchema: fullWidthField,
      },
      {
        key: 'providerName',
        label: 'Provider Name',
        description:
          'Optional registered SMS provider class name. If omitted, the smsProvider setting is used.',
        valueType: 'string',
        expressionAllowed: true,
        group: 'Advanced',
        uiSchema: fullWidthField,
      },
    ],
    outputs: [
      {
        key: 'ok',
        label: 'OK',
        description: 'Whether the SMS provider call completed.',
        valueType: 'boolean',
        path: 'ok',
      },
      {
        key: 'response',
        label: 'Provider Response',
        description: 'Response returned by the active native SMS provider.',
        valueType: 'any',
        path: 'response',
      },
      {
        key: 'to',
        label: 'To',
        description: 'Resolved recipients.',
        valueType: 'array',
        path: 'to',
      },
      {
        key: 'mode',
        label: 'Mode',
        description: 'Resolved send mode.',
        valueType: 'string',
        path: 'mode',
      },
    ],
    supportsExpressions: true,
    supportsRetryPolicy: true,
    supportsTimeoutMs: true,
    supportsOnError: true,
    supportsDisableToggle: true,
    supportsName: true,
    supportsDescription: true,
    searchableText: [
      'sms',
      'text',
      'send',
      'notification',
      'template',
      'solidx',
    ],
  },
  runtime: {
    emitsLogs: true,
    emitsArtifacts: false,
    deterministicOutputs: false,
    executionMode: 'task',
    successStatuses: ['success'],
  },
  documentation: {
    summary:
      'Sends raw or template-based SMS through the configured native SolidX SMS provider.',
  },
  ui: {
    icon: 'si-send',
    iconColor: '#0f766e',
    iconBackgroundColor: '#ccfbf1',
    iconBorderColor: '#99f6e4',
    defaultEditorMode: 'schema',
    modalSize: 'xl',
    layoutHints: {
      preferredPanel: 'flow',
      groupOrder: ['Recipients', 'Message', 'Template', 'Delivery', 'Advanced'],
      stickySummary: true,
    },
  },
})
export class SolidXSendSmsNode implements WorkflowNodeHandler {
  constructor(private readonly smsFactory: SmsFactory) {}

  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.expression.interpolate(
      context.node.configuration ?? {},
      context,
    );

    const mode = configuration.mode ?? 'template';
    const to = this.normalizeRecipients(configuration.to);
    if (!to.length) {
      throw new BadRequestException('solidx.sms.send requires recipients.');
    }

    const shouldQueueSms = configuration.shouldQueueSms !== false;
    const smsService = this.smsFactory.getSmsService(configuration.providerName);

    if (!smsService) {
      throw new BadRequestException('No SolidX SMS provider is configured.');
    }

    let response: any;
    let body = configuration.body;
    let templateName = configuration.templateName;

    if (mode === 'template') {
      if (!templateName) {
        throw new BadRequestException(
          'solidx.sms.send requires templateName in template mode.',
        );
      }

      response = await smsService.sendSMSUsingTemplate(
        to.join(','),
        templateName,
        configuration.templateParams ?? {},
        shouldQueueSms,
      );
    } else {
      body = configuration.body;
      if (!body) {
        throw new BadRequestException(
          'solidx.sms.send requires body in raw mode.',
        );
      }

      response = await smsService.sendSMS(to.join(','), body, shouldQueueSms);
    }

    await context.emitLog({
      level: 'info',
      eventType: 'node.solidx.sms.sent',
      source: 'solidx.sms.send',
      message:
        mode === 'template'
          ? `SolidX SMS template "${templateName}" queued/sent to ${to.join(', ')}.`
          : `SolidX SMS queued/sent to ${to.join(', ')}.`,
      metadata: {
        mode,
        to,
        shouldQueueSms,
        providerName: configuration.providerName,
      },
    });

    return {
      output: {
        ok: true,
        mode,
        to,
        body,
        templateName,
        queued: shouldQueueSms,
        providerName: configuration.providerName,
        response,
      },
    };
  }

  private normalizeRecipients(value: any): string[] {
    if (value === undefined || value === null || value === '') {
      return [];
    }

    if (Array.isArray(value)) {
      return value
        .flatMap((entry) => this.normalizeRecipients(entry))
        .filter(Boolean);
    }

    return String(value)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}
