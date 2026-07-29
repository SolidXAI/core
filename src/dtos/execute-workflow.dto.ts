export class ExecuteWorkflowDto {
  input?: Record<string, any>;
  variables?: Record<string, any>;
  triggerType?: string;
  requestedByUserId?: number;
}
