import { BadRequestException } from '@nestjs/common';
import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
  WorkflowNodeProviderMetadata,
} from '../../../types/workflow-dsl.types';
import {
  buildSolidXPath,
  executeSolidXRequest,
  SolidXCrudOperation,
} from './solidx-api.helpers';

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

const commonOutputs = [
  {
    key: 'ok',
    label: 'OK',
    description: 'Whether the SolidX API response was successful.',
    valueType: 'boolean' as const,
    path: 'ok',
  },
  {
    key: 'status',
    label: 'Status',
    description: 'HTTP status code.',
    valueType: 'integer' as const,
    path: 'status',
  },
  {
    key: 'data',
    label: 'Data',
    description: 'Unwrapped SolidX response data.',
    valueType: 'any' as const,
    path: 'data',
  },
  {
    key: 'raw',
    label: 'Raw Response',
    description: 'Full response payload before SolidX data unwrapping.',
    valueType: 'any' as const,
    path: 'raw',
  },
  {
    key: 'uri',
    label: 'URI',
    description: 'Final request URI.',
    valueType: 'uri' as const,
    path: 'uri',
  },
];

function createCrudMetadata(options: {
  type: string;
  label: string;
  description: string;
  operation: SolidXCrudOperation;
  method: string;
  requiresId?: boolean;
  requiresData?: boolean;
  icon: string;
  iconColor: string;
  iconBackgroundColor: string;
  iconBorderColor: string;
}): WorkflowNodeProviderMetadata {
  const required = ['apiBaseUrl', 'model', 'accessToken'];
  if (options.requiresId) {
    required.push('id');
  }
  if (options.requiresData) {
    required.push('data');
  }

  return {
    type: options.type,
    kind: 'task',
    version: '1.0.0',
    category: 'integration',
    subcategory: 'solidx',
    label: options.label,
    description: options.description,
    tags: ['solidx', 'crud', options.operation, 'api', 'model'],
    aliases: [`solid.${options.operation}`, `solidx.${options.method.toLowerCase()}`],
    configSchema: {
      type: 'object',
      required,
      properties: {
        apiBaseUrl: { type: 'string' },
        model: { type: 'string' },
        id: {},
        accessToken: { type: 'string' },
        query: { type: 'object', default: {} },
        data: {},
        headers: { type: 'object', default: {} },
        timeoutMs: { type: 'number', default: 30000 },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        status: { type: 'number' },
        statusText: { type: 'string' },
        headers: { type: 'object' },
        data: {},
        raw: {},
        uri: { type: 'string' },
        method: { type: 'string' },
        model: { type: 'string' },
        id: {},
        operation: { type: 'string' },
      },
    },
    examples: [
      {
        key: `${options.operation}-example`,
        label: options.label,
        description:
          'Use expressions to pass tokens and values from earlier workflow steps.',
        language: 'yaml',
        snippet: buildExampleSnippet(options.operation),
        configurationOnly: true,
      },
    ],
    definitions: [
      {
        key: 'model-field',
        label: 'Model/resource field',
        content:
          'The model field is the SolidX REST resource slug, for example `user`, `workflow-definition`, or `model-metadata`. Leading `/api/` is accepted and normalized.',
      },
      {
        key: 'expression-fields',
        label: 'Expression-enabled fields',
        content:
          'Access tokens, ids, query values, and JSON payloads may use expressions such as `{{ outputs.login.accessToken }}` or `{{ outputs.findUser.data.id }}`.',
      },
    ],
    authoring: {
      defaultConfiguration: {
        query: {},
        headers: {},
        timeoutMs: 30000,
      },
      configurationFields: [
        {
          key: 'apiBaseUrl',
          label: 'API Base URL',
          description:
            'Base URL of the SolidX API host, without /api. Expressions are allowed.',
          valueType: 'uri',
          required: true,
          expressionAllowed: true,
          group: 'Request',
          uiSchema: fullWidthField,
        },
        {
          key: 'model',
          label: 'Model',
          description:
            'SolidX REST resource slug, for example user or workflow-definition.',
          valueType: 'string',
          required: true,
          expressionAllowed: true,
          group: 'Request',
          uiSchema: fullWidthField,
        },
        {
          key: 'id',
          label: 'Record ID',
          description: 'Record identifier. Expressions are allowed.',
          valueType: 'any',
          required: options.requiresId,
          expressionAllowed: true,
          group: 'Request',
          uiSchema: {
            ...fullWidthField,
            visibleWhen: {
              field: 'model',
              isSet: true,
            },
          },
        },
        {
          key: 'accessToken',
          label: 'Access Token',
          description:
            'Bearer token, typically {{ outputs.login.accessToken }}.',
          valueType: 'secret',
          required: true,
          expressionAllowed: true,
          secretAllowed: true,
          group: 'Authentication',
          uiSchema: fullWidthField,
        },
        {
          key: 'query',
          label: 'Query Parameters',
          description: 'Optional query-string parameters. Expressions are allowed.',
          valueType: 'object',
          expressionAllowed: true,
          group: 'Request',
          widgetHint: 'key-value-editor',
          uiSchema: fullWidthField,
        },
        {
          key: 'data',
          label: 'JSON Data',
          description:
            'JSON request payload for create, update, or patch. Expressions are allowed.',
          valueType: 'object',
          required: options.requiresData,
          expressionAllowed: true,
          group: 'Payload',
          widgetHint: 'json-editor',
          uiSchema: jsonEditorField,
        },
        {
          key: 'headers',
          label: 'Headers',
          description:
            'Optional extra headers. Authorization and Content-Type are handled automatically unless overridden.',
          valueType: 'object',
          expressionAllowed: true,
          group: 'Advanced',
          widgetHint: 'key-value-editor',
          uiSchema: fullWidthField,
        },
        {
          key: 'timeoutMs',
          label: 'Timeout (ms)',
          description: 'Abort the request after this many milliseconds.',
          valueType: 'number',
          defaultValue: 30000,
          group: 'Advanced',
          uiSchema: fullWidthField,
        },
      ],
      outputs: commonOutputs,
      supportsExpressions: true,
      supportsRetryPolicy: true,
      supportsTimeoutMs: true,
      supportsOnError: true,
      supportsDisableToggle: true,
      supportsName: true,
      supportsDescription: true,
      searchableText: [
        'solidx',
        'solid',
        'crud',
        options.operation,
        'model',
        'rest',
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
      summary: options.description,
    },
    ui: {
      icon: options.icon,
      iconColor: options.iconColor,
      iconBackgroundColor: options.iconBackgroundColor,
      iconBorderColor: options.iconBorderColor,
      defaultEditorMode: 'schema',
      modalSize: 'xl',
      layoutHints: {
        preferredPanel: 'flow',
        groupOrder: ['Request', 'Authentication', 'Payload', 'Advanced'],
        stickySummary: true,
      },
    },
  };
}

abstract class BaseSolidXCrudNode implements WorkflowNodeHandler {
  protected abstract readonly operation: SolidXCrudOperation;
  protected abstract readonly method: string;
  protected abstract readonly requiresId: boolean;
  protected abstract readonly requiresData: boolean;

  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.expression.interpolate(
      context.node.configuration ?? {},
      context,
    );

    const id = configuration.id;
    if (this.requiresId && (id === undefined || id === null || id === '')) {
      throw new BadRequestException(
        `${context.node.type} requires configuration.id.`,
      );
    }

    if (
      this.requiresData &&
      (configuration.data === undefined || configuration.data === null)
    ) {
      throw new BadRequestException(
        `${context.node.type} requires configuration.data.`,
      );
    }

    const result = await executeSolidXRequest({
      apiBaseUrl: configuration.apiBaseUrl,
      path: buildSolidXPath(configuration.model, id),
      method: this.method,
      accessToken: configuration.accessToken,
      headers: configuration.headers,
      query: configuration.query,
      body: this.requiresData ? configuration.data : undefined,
      timeoutMs: configuration.timeoutMs ?? context.node.timeoutMs ?? 30000,
    });

    await context.emitLog({
      level: result.ok ? 'info' : 'warn',
      eventType: `node.solidx.${this.operation}`,
      source: context.node.type,
      message: `SolidX ${this.operation} ${configuration.model} returned ${result.status}.`,
      metadata: {
        model: configuration.model,
        id,
        status: result.status,
      },
    });

    return {
      output: {
        ok: result.ok,
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        data: result.data,
        raw: result.raw,
        uri: result.uri,
        method: result.method,
        model: configuration.model,
        id,
        operation: this.operation,
      },
    };
  }
}

@WorkflowNodeProvider(
  createCrudMetadata({
    type: 'solidx.list',
    label: 'SolidX List',
    description: 'Lists records from any SolidX model/resource.',
    operation: 'list',
    method: 'GET',
    icon: 'si-th-large',
    iconColor: '#2563eb',
    iconBackgroundColor: '#dbeafe',
    iconBorderColor: '#bfdbfe',
  }),
)
export class SolidXListNode extends BaseSolidXCrudNode {
  protected readonly operation = 'list' as const;
  protected readonly method = 'GET';
  protected readonly requiresId = false;
  protected readonly requiresData = false;
}

@WorkflowNodeProvider(
  createCrudMetadata({
    type: 'solidx.get',
    label: 'SolidX Get',
    description: 'Fetches one record from any SolidX model/resource.',
    operation: 'get',
    method: 'GET',
    requiresId: true,
    icon: 'si-search',
    iconColor: '#0891b2',
    iconBackgroundColor: '#cffafe',
    iconBorderColor: '#a5f3fc',
  }),
)
export class SolidXGetNode extends BaseSolidXCrudNode {
  protected readonly operation = 'get' as const;
  protected readonly method = 'GET';
  protected readonly requiresId = true;
  protected readonly requiresData = false;
}

@WorkflowNodeProvider(
  createCrudMetadata({
    type: 'solidx.create',
    label: 'SolidX Create',
    description: 'Creates a JSON-backed record in any SolidX model/resource.',
    operation: 'create',
    method: 'POST',
    requiresData: true,
    icon: 'si-plus',
    iconColor: '#16a34a',
    iconBackgroundColor: '#dcfce7',
    iconBorderColor: '#bbf7d0',
  }),
)
export class SolidXCreateNode extends BaseSolidXCrudNode {
  protected readonly operation = 'create' as const;
  protected readonly method = 'POST';
  protected readonly requiresId = false;
  protected readonly requiresData = true;
}

@WorkflowNodeProvider(
  createCrudMetadata({
    type: 'solidx.update',
    label: 'SolidX Update',
    description: 'Replaces a JSON-backed record in any SolidX model/resource.',
    operation: 'update',
    method: 'PUT',
    requiresId: true,
    requiresData: true,
    icon: 'si-pencil',
    iconColor: '#ea580c',
    iconBackgroundColor: '#ffedd5',
    iconBorderColor: '#fed7aa',
  }),
)
export class SolidXUpdateNode extends BaseSolidXCrudNode {
  protected readonly operation = 'update' as const;
  protected readonly method = 'PUT';
  protected readonly requiresId = true;
  protected readonly requiresData = true;
}

@WorkflowNodeProvider(
  createCrudMetadata({
    type: 'solidx.patch',
    label: 'SolidX Patch',
    description:
      'Partially updates a JSON-backed record in any SolidX model/resource.',
    operation: 'patch',
    method: 'PATCH',
    requiresId: true,
    requiresData: true,
    icon: 'si-file-edit',
    iconColor: '#9333ea',
    iconBackgroundColor: '#f3e8ff',
    iconBorderColor: '#e9d5ff',
  }),
)
export class SolidXPatchNode extends BaseSolidXCrudNode {
  protected readonly operation = 'patch' as const;
  protected readonly method = 'PATCH';
  protected readonly requiresId = true;
  protected readonly requiresData = true;
}

@WorkflowNodeProvider(
  createCrudMetadata({
    type: 'solidx.delete',
    label: 'SolidX Delete',
    description: 'Deletes one record from any SolidX model/resource.',
    operation: 'delete',
    method: 'DELETE',
    requiresId: true,
    icon: 'si-trash',
    iconColor: '#dc2626',
    iconBackgroundColor: '#fee2e2',
    iconBorderColor: '#fecaca',
  }),
)
export class SolidXDeleteNode extends BaseSolidXCrudNode {
  protected readonly operation = 'delete' as const;
  protected readonly method = 'DELETE';
  protected readonly requiresId = true;
  protected readonly requiresData = false;
}

function buildExampleSnippet(operation: SolidXCrudOperation): string {
  const base =
    'apiBaseUrl: http://localhost:3000\nmodel: user\naccessToken: "{{ outputs.login.accessToken }}"\n';

  if (operation === 'list') {
    return `${base}query:\n  limit: 25\n  offset: 0\n`;
  }

  if (operation === 'get' || operation === 'delete') {
    return `${base}id: "{{ outputs.findUser.data.id }}"\n`;
  }

  if (operation === 'create') {
    return `${base}data:\n  username: "{{ input.username }}"\n  email: "{{ input.email }}"\n`;
  }

  return `${base}id: "{{ outputs.findUser.data.id }}"\ndata:\n  displayName: "{{ input.displayName }}"\n`;
}
