import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';

@WorkflowNodeProvider({
  type: 'log.write',
  kind: 'task',
  category: 'core',
  label: 'Write Log',
  description: 'Writes an execution log entry and returns the rendered message.',
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
