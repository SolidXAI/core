import { BadRequestException } from '@nestjs/common';
import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
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
      query: {
        type: 'object',
        default: {},
      },
      bodyMode: {
        type: 'string',
        enum: ['none', 'raw', 'form-data'],
        default: 'none',
      },
      rawContentType: {
        type: 'string',
        default: 'application/json',
      },
      rawBody: {},
      formData: {
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
    'ui:order': [
      'method',
      'uri',
      'query',
      'headers',
      'bodyMode',
      'rawContentType',
      'rawBody',
      'formData',
      'timeoutMs',
    ],
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
        'method: GET\nuri: "{{ input.endpoint }}"\nquery:\n  includeInactive: "false"\ntimeoutMs: 30000\n',
      configurationOnly: true,
    },
    {
      key: 'raw-post',
      label: 'POST raw JSON',
      description:
        'Send a raw JSON request body with an explicit content type.',
      language: 'yaml',
      snippet:
        'method: POST\nuri: https://api.example.com/orders\nheaders:\n  Authorization: "Bearer {{ variables.apiToken }}"\nbodyMode: raw\nrawContentType: application/json\nrawBody: |\n  {\n    "customerId": "{{ outputs.customer.id }}",\n    "priority": "high"\n  }\n',
      configurationOnly: true,
    },
    {
      key: 'form-data-post',
      label: 'POST form data',
      description:
        'Send simple form-data fields. File values will be added once workflow file handling is introduced.',
      language: 'yaml',
      snippet:
        'method: POST\nuri: https://api.example.com/upload\nbodyMode: form-data\nformData:\n  name: "{{ inputs.name }}"\n  source: workflow\n',
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
    {
      key: 'query-field',
      label: 'Query parameters',
      content:
        '`query` is resolved after expressions are evaluated and appended to the target URI as query-string parameters.',
    },
    {
      key: 'body-mode-field',
      label: 'Body modes',
      content:
        '`bodyMode` controls the request payload: `none` sends no body, `raw` sends `rawBody` with `rawContentType`, and `form-data` sends key/value form fields. File form-data values will be supported by a later file-handling pass.',
    },
  ],
  authoring: {
    defaultConfiguration: {
      method: 'GET',
      query: {},
      headers: {},
      bodyMode: 'none',
      rawContentType: 'application/json',
      formData: {},
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
        uiSchema: fullWidthField,
      },
      {
        key: 'uri',
        label: 'URI',
        description: 'The target URI. Expressions are allowed.',
        valueType: 'uri',
        required: true,
        expressionAllowed: true,
        group: 'Request',
        uiSchema: fullWidthField,
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
        uiSchema: fullWidthField,
      },
      {
        key: 'query',
        label: 'Query Parameters',
        description: 'Optional query-string parameters appended to the URI.',
        valueType: 'object',
        expressionAllowed: true,
        group: 'Request',
        widgetHint: 'key-value-editor',
        uiSchema: fullWidthField,
      },
      {
        key: 'bodyMode',
        label: 'Body Mode',
        description: 'Controls how the request body is sent.',
        valueType: 'string',
        enumValues: ['none', 'raw', 'form-data'],
        defaultValue: 'none',
        group: 'Body',
        uiSchema: fullWidthField,
      },
      {
        key: 'rawContentType',
        label: 'Raw Content Type',
        description:
          'Content-Type header used when Body Mode is raw. Explicit headers still win.',
        valueType: 'string',
        enumValues: [
          'application/json',
          'text/plain',
          'application/xml',
          'text/html',
          'application/x-www-form-urlencoded',
        ],
        defaultValue: 'application/json',
        group: 'Body',
        uiSchema: {
          ...fullWidthField,
          visibleWhen: {
            field: 'bodyMode',
            equals: 'raw',
          },
        },
      },
      {
        key: 'rawBody',
        label: 'Raw Body',
        description:
          'Raw request payload sent exactly as typed after expression evaluation.',
        valueType: 'string',
        expressionAllowed: true,
        group: 'Body',
        widgetHint: 'raw-editor',
        uiSchema: {
          ...fullWidthField,
          editor: {
            language: 'json',
          },
          visibleWhen: {
            field: 'bodyMode',
            equals: 'raw',
          },
        },
      },
      {
        key: 'formData',
        label: 'Form Data',
        description:
          'Form-data fields. File inputs will be added once workflow file handling is introduced.',
        valueType: 'object',
        expressionAllowed: true,
        group: 'Body',
        widgetHint: 'key-value-editor',
        uiSchema: {
          ...fullWidthField,
          visibleWhen: {
            field: 'bodyMode',
            equals: 'form-data',
          },
        },
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
      rawBody: 'workflow.node.field.httpBody',
    },
    layoutHints: {
      preferredPanel: 'flow',
      groupOrder: ['Request', 'Body', 'Advanced'],
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
      const method = String(configuration.method ?? 'GET').toUpperCase();
      const requestHeaders = this.normalizeHeaders(configuration.headers);
      const finalUri = this.buildUri(uri, configuration.query);
      const requestBody = this.resolveRequestBody(
        configuration,
        requestHeaders,
        method,
      );

      const response = await fetchImpl(finalUri, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal,
      } as any);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const text = await response.text();
      const responseBody = this.parseBody(text);

      await context.emitLog({
        level: response.ok ? 'info' : 'warn',
        eventType: 'node.http.response',
        source: 'http.request',
        message: `HTTP ${method} ${finalUri} returned ${response.status}.`,
      });

      return {
        output: {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody,
          uri: finalUri,
          method,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUri(uri: string, query: any): string {
    if (!query || typeof query !== 'object') {
      return uri;
    }

    const url = new URL(uri);
    const appendValue = (key: string, value: any) => {
      if (!key || value === undefined || value === null) {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => appendValue(key, item));
        return;
      }
      if (typeof value === 'object') {
        url.searchParams.append(key, JSON.stringify(value));
        return;
      }
      url.searchParams.append(key, String(value));
    };

    if (Array.isArray(query)) {
      query.forEach((item) => {
        appendValue(String(item?.key ?? item?.name ?? ''), item?.value);
      });
      return url.toString();
    }

    Object.entries(query).forEach(([key, value]) => appendValue(key, value));
    return url.toString();
  }

  private resolveRequestBody(
    configuration: Record<string, any>,
    headers: Record<string, string>,
    method: string,
  ): any {
    if (method === 'GET' || method === 'HEAD') {
      return undefined;
    }

    const legacyBodyConfigured =
      configuration.body !== undefined && configuration.body !== null;
    const bodyMode = configuration.bodyMode ?? (legacyBodyConfigured ? 'raw' : 'none');

    if (bodyMode === 'none') {
      return undefined;
    }

    if (bodyMode === 'form-data') {
      const formData = this.buildFormData(configuration.formData);
      this.deleteHeader(headers, 'content-type');
      return formData;
    }

    const rawBody =
      configuration.rawBody !== undefined ? configuration.rawBody : configuration.body;

    if (rawBody === undefined || rawBody === null) {
      return undefined;
    }

    const contentType = configuration.rawContentType ?? 'application/json';
    this.setHeaderIfMissing(headers, 'Content-Type', contentType);

    if (typeof rawBody === 'string') {
      return rawBody;
    }

    if (String(contentType).toLowerCase().includes('json')) {
      return JSON.stringify(rawBody);
    }

    return typeof rawBody === 'object' ? JSON.stringify(rawBody) : String(rawBody);
  }

  private buildFormData(formDataConfig: any): any {
    const FormDataConstructor = globalThis.FormData;
    if (!FormDataConstructor) {
      throw new BadRequestException('global FormData is not available.');
    }

    const formData = new FormDataConstructor();
    const appendValue = (key: string, value: any) => {
      if (!key || value === undefined || value === null) {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => appendValue(key, item));
        return;
      }
      const BlobConstructor = (globalThis as any).Blob;
      const FileConstructor = (globalThis as any).File;
      if (
        (BlobConstructor && value instanceof BlobConstructor) ||
        (FileConstructor && value instanceof FileConstructor)
      ) {
        formData.append(key, value);
        return;
      }
      formData.append(
        key,
        typeof value === 'object' ? JSON.stringify(value) : String(value),
      );
    };

    if (Array.isArray(formDataConfig)) {
      formDataConfig.forEach((item) => {
        appendValue(String(item?.key ?? item?.name ?? ''), item?.value);
      });
      return formData;
    }

    Object.entries(formDataConfig ?? {}).forEach(([key, value]) =>
      appendValue(key, value),
    );
    return formData;
  }

  private normalizeHeaders(headers: any): Record<string, string> {
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
      return {};
    }

    return Object.entries(headers).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (value === undefined || value === null) {
          return acc;
        }
        acc[key] = String(value);
        return acc;
      },
      {},
    );
  }

  private setHeaderIfMissing(
    headers: Record<string, string>,
    name: string,
    value: string,
  ) {
    const existingKey = Object.keys(headers).find(
      (key) => key.toLowerCase() === name.toLowerCase(),
    );
    if (!existingKey) {
      headers[name] = value;
    }
  }

  private deleteHeader(headers: Record<string, string>, name: string) {
    const existingKey = Object.keys(headers).find(
      (key) => key.toLowerCase() === name.toLowerCase(),
    );
    if (existingKey) {
      delete headers[existingKey];
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
