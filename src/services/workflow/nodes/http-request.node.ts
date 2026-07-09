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
  category: 'integration',
  label: 'HTTP Request',
  description: 'Executes an HTTP request and returns status, headers, and body.',
})
export class HttpRequestNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.expression.interpolate(
      context.node.configuration ?? {},
      context,
    );

    if (!configuration.url) {
      throw new BadRequestException('http.request requires configuration.url.');
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
      const response = await fetchImpl(configuration.url, {
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
        message: `HTTP ${configuration.method ?? 'GET'} ${configuration.url} returned ${response.status}.`,
      });

      return {
        output: {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers,
          body,
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
