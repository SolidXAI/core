import { Injectable } from '@nestjs/common';
import {
  WorkflowExecutionRequest,
  WorkflowExecutionResponse,
} from '../../types/workflow-dsl.types';
import { WorkflowRuntimeService } from './workflow-runtime.service';

@Injectable()
export class WorkflowInvocationService {
  constructor(private readonly workflowRuntimeService: WorkflowRuntimeService) {}

  executeById(
    id: number,
    request: WorkflowExecutionRequest = {},
  ): Promise<WorkflowExecutionResponse> {
    return this.workflowRuntimeService.executeDefinitionById(id, request);
  }

  executeByKey(
    key: string,
    request: WorkflowExecutionRequest = {},
  ): Promise<WorkflowExecutionResponse> {
    return this.workflowRuntimeService.executeDefinitionByKey(key, request);
  }
}
