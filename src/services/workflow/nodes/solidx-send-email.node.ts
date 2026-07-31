import { BadRequestException } from '@nestjs/common';
import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { MailFactory } from '../../../factories/mail.factory';
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
  type: 'solidx.email.send',
  kind: 'task',
  version: '1.0.0',
  category: 'integration',
  subcategory: 'solidx',
  label: 'Send Email',
  description:
    'Sends an email using the native SolidX mail provider and queue settings.',
  tags: ['solidx', 'email', 'mail', 'notification', 'template'],
  aliases: ['email.send', 'mail.send', 'solidx.mail.send'],
  configSchema: {
    type: 'object',
    required: ['to', 'mode'],
    properties: {
      mode: {
        type: 'string',
        enum: ['raw', 'template'],
        default: 'raw',
      },
      to: {},
      subject: { type: 'string' },
      body: { type: 'string' },
      templateName: { type: 'string' },
      templateParams: { type: 'object', default: {} },
      shouldQueueEmails: { type: 'boolean', default: true },
      cc: {},
      bcc: {},
      from: { type: 'string' },
      parentEntity: { type: 'string' },
      parentEntityId: { type: 'string' },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      mode: { type: 'string' },
      to: {},
      cc: {},
      bcc: {},
      subject: { type: 'string' },
      templateName: { type: 'string' },
      queued: { type: 'boolean' },
      response: {},
    },
  },
  examples: [
    {
      key: 'template-email',
      label: 'Template email',
      description:
        'Render a SolidX email template and queue the email for delivery.',
      language: 'yaml',
      snippet:
        'mode: template\nto: "{{ input.email }}"\ntemplateName: welcome-email\ntemplateParams:\n  name: "{{ input.name }}"\n  activationUrl: "{{ outputs.createInvite.data.url }}"\nshouldQueueEmails: true\n',
      configurationOnly: true,
    },
    {
      key: 'raw-email',
      label: 'Raw email',
      description: 'Send a direct subject/body email.',
      language: 'yaml',
      snippet:
        'mode: raw\nto:\n  - ops@example.com\nsubject: "Workflow {{ execution.executionIdentifier }} completed"\nbody: "<p>The workflow completed successfully.</p>"\nshouldQueueEmails: true\n',
      configurationOnly: true,
    },
  ],
  definitions: [
    {
      key: 'native-mail-provider',
      label: 'Native SolidX mail provider',
      content:
        'This task resolves the active SolidX mail provider through MailFactory, so SMTP, Elastic Email, or consuming-project providers can be selected by the existing emailProvider setting.',
    },
    {
      key: 'queueing',
      label: 'Queueing',
      content:
        'shouldQueueEmails is passed to the native provider. Providers may still queue based on system settings even when this value is false.',
    },
  ],
  authoring: {
    defaultConfiguration: {
      mode: 'raw',
      templateParams: {},
      shouldQueueEmails: true,
      cc: [],
      bcc: [],
    },
    configurationFields: [
      {
        key: 'mode',
        label: 'Mode',
        description: 'Send a raw email or render a SolidX email template.',
        valueType: 'string',
        enumValues: ['raw', 'template'],
        defaultValue: 'raw',
        required: true,
        group: 'Message',
        uiSchema: fullWidthField,
      },
      {
        key: 'to',
        label: 'To',
        description:
          'Recipient email address, comma-separated list, or array. Expressions are allowed. Use a pure expression like "{{ outputs.someStep.emails }}" when the expression should evaluate to an array; mixed text such as "ops@example.com, {{ outputs.someStep.emails }}" is treated as comma-separated text.',
        valueType: 'array',
        required: true,
        expressionAllowed: true,
        group: 'Recipients',
        widgetHint: 'recipient-list',
        uiSchema: {
          ...fullWidthField,
          placeholder: '{{ item.email }}',
        },
      },
      {
        key: 'subject',
        label: 'Subject',
        description: 'Email subject for raw mode. Expressions are allowed.',
        valueType: 'string',
        required: true,
        expressionAllowed: true,
        group: 'Message',
        uiSchema: {
          ...fullWidthField,
          visibleWhen: {
            field: 'mode',
            equals: 'raw',
          },
        },
      },
      {
        key: 'body',
        label: 'Body',
        description:
          'HTML email body for raw mode. Expressions are allowed.',
        valueType: 'string',
        required: true,
        expressionAllowed: true,
        group: 'Message',
        widgetHint: 'raw-editor',
        uiSchema: {
          ...fullWidthField,
          editor: {
            language: 'html',
          },
          visibleWhen: {
            field: 'mode',
            equals: 'raw',
          },
        },
      },
      {
        key: 'templateName',
        label: 'Template Name',
        description:
          'SolidX email template name/user key for template mode. Expressions are allowed.',
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
          'JSON parameters used when rendering the email template. Expressions are allowed.',
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
        key: 'shouldQueueEmails',
        label: 'Queue Email',
        description: 'Use the native SolidX email queue when available.',
        valueType: 'boolean',
        defaultValue: true,
        group: 'Delivery',
        uiSchema: fullWidthField,
      },
      {
        key: 'cc',
        label: 'CC',
        description:
          'Optional CC recipients as comma-separated text or an array. Expressions are allowed. Use a pure expression like "{{ outputs.someStep.emails }}" when the expression should evaluate to an array; mixed text such as "ops@example.com, {{ outputs.someStep.emails }}" is treated as comma-separated text.',
        valueType: 'array',
        expressionAllowed: true,
        group: 'Recipients',
        widgetHint: 'recipient-list',
        uiSchema: {
          ...fullWidthField,
          placeholder: '{{ outputs.someStep.ccEmails }}',
        },
      },
      {
        key: 'bcc',
        label: 'BCC',
        description:
          'Optional BCC recipients as comma-separated text or an array. Expressions are allowed. Use a pure expression like "{{ outputs.someStep.emails }}" when the expression should evaluate to an array; mixed text such as "ops@example.com, {{ outputs.someStep.emails }}" is treated as comma-separated text.',
        valueType: 'array',
        expressionAllowed: true,
        group: 'Recipients',
        widgetHint: 'recipient-list',
        uiSchema: {
          ...fullWidthField,
          placeholder: '{{ outputs.someStep.bccEmails }}',
        },
      },
      {
        key: 'from',
        label: 'From',
        description:
          'Optional sender address. If omitted, the active provider setting is used.',
        valueType: 'string',
        expressionAllowed: true,
        group: 'Delivery',
        uiSchema: fullWidthField,
      },
      {
        key: 'parentEntity',
        label: 'Parent Entity',
        description: 'Optional entity key used by providers for audit linkage.',
        valueType: 'string',
        expressionAllowed: true,
        group: 'Advanced',
        uiSchema: fullWidthField,
      },
      {
        key: 'parentEntityId',
        label: 'Parent Entity ID',
        description: 'Optional entity id used by providers for audit linkage.',
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
        description: 'Whether the mail provider call completed.',
        valueType: 'boolean',
        path: 'ok',
      },
      {
        key: 'response',
        label: 'Provider Response',
        description: 'Response returned by the active native mail provider.',
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
      'email',
      'mail',
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
      'Sends raw or template-based email through the configured native SolidX mail provider.',
  },
  ui: {
    icon: 'si-envelope',
    iconColor: '#db2777',
    iconBackgroundColor: '#fce7f3',
    iconBorderColor: '#fbcfe8',
    defaultEditorMode: 'schema',
    modalSize: 'xl',
    layoutHints: {
      preferredPanel: 'flow',
      groupOrder: [
        'Recipients',
        'Message',
        'Template',
        'Delivery',
        'Advanced',
      ],
      stickySummary: true,
    },
  },
})
export class SolidXSendEmailNode implements WorkflowNodeHandler {
  constructor(private readonly mailFactory: MailFactory) {}

  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.expression.interpolate(
      context.node.configuration ?? {},
      context,
    );

    const mode = configuration.mode ?? 'raw';
    const to = this.normalizeRecipients(configuration.to);
    if (!to.length) {
      throw new BadRequestException('solidx.email.send requires recipients.');
    }

    const shouldQueueEmails = configuration.shouldQueueEmails !== false;
    const cc = this.normalizeRecipients(configuration.cc);
    const bcc = this.normalizeRecipients(configuration.bcc);
    const attachments = this.normalizeArray(configuration.attachments);
    const wrapperAttachments = this.normalizeArray(
      configuration.wrapperAttachments,
    );
    const mailService = this.mailFactory.getMailService();

    if (!mailService) {
      throw new BadRequestException('No SolidX mail provider is configured.');
    }

    let response: any;
    let subject = configuration.subject;
    let templateName = configuration.templateName;

    if (mode === 'template') {
      if (!templateName) {
        throw new BadRequestException(
          'solidx.email.send requires templateName in template mode.',
        );
      }

      response = await mailService.sendEmailUsingTemplate(
        to.join(','),
        templateName,
        configuration.templateParams ?? {},
        shouldQueueEmails,
        wrapperAttachments,
        attachments,
        configuration.parentEntity,
        configuration.parentEntityId,
        cc,
        bcc,
        configuration.from,
      );
    } else {
      subject = configuration.subject;
      const body = configuration.body;
      if (!subject || !body) {
        throw new BadRequestException(
          'solidx.email.send requires subject and body in raw mode.',
        );
      }

      response = await mailService.sendEmail(
        to.join(','),
        subject,
        body,
        shouldQueueEmails,
        wrapperAttachments,
        attachments,
        configuration.parentEntity,
        configuration.parentEntityId,
        cc,
        bcc,
        configuration.from,
      );
    }

    await context.emitLog({
      level: 'info',
      eventType: 'node.solidx.email.sent',
      source: 'solidx.email.send',
      message:
        mode === 'template'
          ? `SolidX email template "${templateName}" queued/sent to ${to.join(', ')}.`
          : `SolidX email "${subject}" queued/sent to ${to.join(', ')}.`,
      metadata: {
        mode,
        to,
        cc,
        bcc,
        shouldQueueEmails,
        parentEntity: configuration.parentEntity,
        parentEntityId: configuration.parentEntityId,
      },
    });

    return {
      output: {
        ok: true,
        mode,
        to,
        cc,
        bcc,
        subject,
        templateName,
        queued: shouldQueueEmails,
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

  private normalizeArray(value: any): any[] {
    if (value === undefined || value === null || value === '') {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  }
}
