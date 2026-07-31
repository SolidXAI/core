import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../types/workflow-dsl.types';

export interface WorkflowNodeHandler {
  execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult>;
}
