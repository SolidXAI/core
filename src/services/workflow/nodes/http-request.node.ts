import { BadRequestException } from '@nestjs/common';
import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';

@WorkflowNodeProvider({
  type: 'http.request',
  kind: 'task',
  version: '1.0.0',
  category: 'integration',
  subcategory: 'http',
  label: 'HTTP Request',
  description: 'Executes an HTTP request and returns status, headers, and body.',
  tags: ['http', 'api', 'integration'],
  aliases: ['http.fetch'],
  configSchema: {
    type: 'object',
    required: ['uri'],
    properties: {
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        default: 'GET',
      },
      uri: {
        type: 'string',
      },
      headers: {
        type: 'object',
        default: {},
      },
      body: {},
      timeoutMs: {
        type: 'number',
        default: 30000,
      },
    },
  },
  uiSchema: {
    'ui:order': ['method', 'uri', 'headers', 'body', 'timeoutMs'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      status: { type: 'number' },
      statusText: { type: 'string' },
      headers: { type: 'object' },
      body: {},
      uri: { type: 'string' },
      method: { type: 'string' },
    },
  },
  examples: [
    {
      key: 'basic-get',
      label: 'Basic GET request',
      description: 'Call an endpoint using an input-provided URI.',
      language: 'yaml',
      snippet:
        'method: GET\nuri: "{{ input.endpoint }}"\ntimeoutMs: 30000\n',
      configurationOnly: true,
    },
  ],
  metrics: [
    {
      key: 'workflow.node.http.duration',
      label: 'Request duration',
      description: 'Measures the end-to-end HTTP request duration.',
      type: 'timer',
      unit: 'ms',
      tags: ['http', 'latency'],
    },
    {
      key: 'workflow.node.http.error.count',
      label: 'HTTP request errors',
      description: 'Counts failed HTTP requests.',
      type: 'counter',
      tags: ['http', 'error'],
    },
  ],
  definitions: [
    {
      key: 'uri-field',
      label: 'URI field',
      content:
        'The canonical request target field is `uri`. `url` is accepted temporarily for backward compatibility during migration.',
    },
  ],
  authoring: {
    defaultConfiguration: {
      method: 'GET',
      headers: {},
      timeoutMs: 30000,
    },
    configurationFields: [
      {
        key: 'method',
        label: 'Method',
        description: 'The HTTP method to use for the request.',
        valueType: 'string',
        enumValues: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        defaultValue: 'GET',
        group: 'Request',
      },
      {
        key: 'uri',
        label: 'URI',
        description: 'The target URI. Expressions are allowed.',
        valueType: 'uri',
        required: true,
        expressionAllowed: true,
        group: 'Request',
      },
      {
        key: 'headers',
        label: 'Headers',
        description: 'Optional request headers.',
        valueType: 'object',
        expressionAllowed: true,
        group: 'Request',
        widgetHint: 'key-value-editor',
        extensionComponentKey: 'workflow.node.field.httpHeaders',
      },
      {
        key: 'body',
        label: 'Body',
        description: 'Optional request body.',
        valueType: 'any',
        expressionAllowed: true,
        group: 'Request',
        widgetHint: 'yaml-editor',
      },
      {
        key: 'timeoutMs',
        label: 'Timeout (ms)',
        description: 'Abort the request after this many milliseconds.',
        valueType: 'number',
        defaultValue: 30000,
        group: 'Advanced',
      },
    ],
    outputs: [
      {
        key: 'ok',
        label: 'OK',
        description: 'Whether the response status was successful.',
        valueType: 'boolean',
        path: 'ok',
      },
      {
        key: 'status',
        label: 'Status',
        description: 'HTTP status code.',
        valueType: 'integer',
        path: 'status',
      },
      {
        key: 'statusText',
        label: 'Status text',
        description: 'HTTP status text.',
        valueType: 'string',
        path: 'statusText',
      },
      {
        key: 'headers',
        label: 'Headers',
        description: 'Resolved response headers.',
        valueType: 'object',
        path: 'headers',
      },
      {
        key: 'body',
        label: 'Body',
        description: 'Parsed response body.',
        valueType: 'any',
        path: 'body',
      },
      {
        key: 'uri',
        label: 'Final URI',
        description: 'The requested URI after expression resolution.',
        valueType: 'uri',
        path: 'uri',
      },
      {
        key: 'method',
        label: 'Method',
        description: 'The resolved request method.',
        valueType: 'string',
        path: 'method',
      },
    ],
    supportsExpressions: true,
    supportsRetryPolicy: true,
    supportsTimeoutMs: true,
    supportsOnError: true,
    supportsDisableToggle: true,
    supportsName: true,
    supportsDescription: true,
    searchableText: ['http', 'request', 'api', 'rest', 'integration'],
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
      'Call an HTTP endpoint, capture the response, and expose structured outputs to downstream nodes. The node returns the response status, headers, and body. Failed transport operations raise an error.',
  },
  ui: {
    icon: 'si-wifi',
    defaultEditorMode: 'schema',
    modalSize: 'xl',
    fieldComponentKeys: {
      headers: 'workflow.node.field.httpHeaders',
      body: 'workflow.node.field.httpBody',
    },
    layoutHints: {
      preferredPanel: 'flow',
      groupOrder: ['Request', 'Advanced'],
      stickySummary: true,
    },
  },
})
export class HttpRequestNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.expression.interpolate(
      context.node.configuration ?? {},
      context,
    );
    const uri = configuration.uri ?? configuration.url;

    if (!uri) {
      throw new BadRequestException(
        'http.request requires configuration.uri.',
      );
    }

    const fetchImpl = globalThis.fetch;
    if (!fetchImpl) {
      throw new BadRequestException('global fetch is not available.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      configuration.timeoutMs ?? context.node.timeoutMs ?? 30000,
    );

    try {
      const response = await fetchImpl(uri, {
        method: configuration.method ?? 'GET',
        headers: configuration.headers,
        body:
          configuration.body === undefined || configuration.body === null
            ? undefined
            : typeof configuration.body === 'string'
              ? configuration.body
              : JSON.stringify(configuration.body),
        signal: controller.signal,
      } as any);

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const text = await response.text();
      const body = this.parseBody(text);

      await context.emitLog({
        level: response.ok ? 'info' : 'warn',
        eventType: 'node.http.response',
        source: 'http.request',
        message: `HTTP ${configuration.method ?? 'GET'} ${uri} returned ${response.status}.`,
      });

      return {
        output: {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers,
          body,
          uri,
          method: configuration.method ?? 'GET',
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseBody(text: string): any {
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
