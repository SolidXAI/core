import { BadRequestException } from '@nestjs/common';
import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';
import { executeSolidXRequest } from './solidx-api.helpers';

const fullWidthField = {
  layout: {
    width: 'full',
  },
};

@WorkflowNodeProvider({
  type: 'solidx.login',
  kind: 'task',
  version: '1.0.0',
  category: 'integration',
  subcategory: 'solidx',
  label: 'SolidX Login',
  description:
    'Authenticates with a SolidX API and exposes access tokens to downstream nodes.',
  tags: ['solidx', 'auth', 'login', 'token'],
  aliases: ['solid.login', 'iam.authenticate'],
  configSchema: {
    type: 'object',
    required: ['apiBaseUrl', 'username', 'password'],
    properties: {
      apiBaseUrl: { type: 'string' },
      username: { type: 'string' },
      password: { type: 'string' },
      timeoutMs: { type: 'number', default: 30000 },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
      user: { type: 'object' },
      status: { type: 'number' },
      ok: { type: 'boolean' },
      raw: { type: 'object' },
    },
  },
  examples: [
    {
      key: 'login',
      label: 'Authenticate and expose token',
      description:
        'Use the access token downstream as {{ outputs.login.accessToken }}.',
      language: 'yaml',
      snippet:
        'apiBaseUrl: http://localhost:3000\nusername: sa\npassword: "{{ variables.solidPassword }}"\n',
      configurationOnly: true,
    },
  ],
  authoring: {
    defaultConfiguration: {
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
        group: 'Authentication',
        uiSchema: fullWidthField,
      },
      {
        key: 'username',
        label: 'Username',
        description: 'SolidX username or email. Expressions are allowed.',
        valueType: 'string',
        required: true,
        expressionAllowed: true,
        group: 'Authentication',
        uiSchema: fullWidthField,
      },
      {
        key: 'password',
        label: 'Password',
        description: 'SolidX password. Expressions are allowed.',
        valueType: 'secret',
        required: true,
        expressionAllowed: true,
        secretAllowed: true,
        group: 'Authentication',
        uiSchema: fullWidthField,
      },
      {
        key: 'timeoutMs',
        label: 'Timeout (ms)',
        description: 'Abort the login request after this many milliseconds.',
        valueType: 'number',
        defaultValue: 30000,
        group: 'Advanced',
        uiSchema: fullWidthField,
      },
    ],
    outputs: [
      {
        key: 'accessToken',
        label: 'Access Token',
        description: 'JWT access token returned by SolidX.',
        valueType: 'secret',
        path: 'accessToken',
        required: true,
      },
      {
        key: 'refreshToken',
        label: 'Refresh Token',
        description: 'Refresh token returned by SolidX.',
        valueType: 'secret',
        path: 'refreshToken',
      },
      {
        key: 'user',
        label: 'User',
        description: 'Authenticated user payload.',
        valueType: 'object',
        path: 'user',
      },
    ],
    supportsExpressions: true,
    supportsRetryPolicy: true,
    supportsTimeoutMs: true,
    supportsOnError: true,
    supportsDisableToggle: true,
    supportsName: true,
    supportsDescription: true,
    searchableText: ['solidx', 'solid', 'login', 'auth', 'token', 'iam'],
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
      'Authenticates with /api/iam/authenticate and exposes accessToken, refreshToken, and user for downstream expressions.',
  },
  ui: {
    icon: 'si-lock',
    iconColor: '#7c3aed',
    iconBackgroundColor: '#ede9fe',
    iconBorderColor: '#ddd6fe',
    defaultEditorMode: 'schema',
    modalSize: 'lg',
    layoutHints: {
      preferredPanel: 'flow',
      groupOrder: ['Authentication', 'Advanced'],
      stickySummary: true,
    },
  },
})
export class SolidXLoginNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.expression.interpolate(
      context.node.configuration ?? {},
      context,
    );

    const username = configuration.username;
    const password = configuration.password;
    if (!username || !password) {
      throw new BadRequestException(
        'solidx.login requires username and password.',
      );
    }

    const result = await executeSolidXRequest({
      apiBaseUrl: configuration.apiBaseUrl,
      path: 'iam/authenticate',
      method: 'POST',
      body: {
        username,
        email: String(username).includes('@') ? username : null,
        password,
      },
      timeoutMs: configuration.timeoutMs ?? context.node.timeoutMs ?? 30000,
    });

    const payload = result.data ?? {};
    const accessToken = payload.accessToken ?? result.raw?.accessToken;
    const refreshToken = payload.refreshToken ?? result.raw?.refreshToken;

    if (!result.ok || !accessToken) {
      throw new BadRequestException(
        `SolidX login failed with status ${result.status}.`,
      );
    }

    await context.emitLog({
      level: 'info',
      eventType: 'node.solidx.login',
      source: 'solidx.login',
      message: `SolidX login succeeded for ${username}.`,
    });

    return {
      output: {
        ok: result.ok,
        status: result.status,
        accessToken,
        refreshToken,
        user: payload.user,
        raw: result.raw,
      },
    };
  }
}
