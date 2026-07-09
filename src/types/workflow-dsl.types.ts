import { WorkflowExecution } from '../entities/workflow-execution.entity';
import { WorkflowStepExecution } from '../entities/workflow-step-execution.entity';

export type WorkflowNodeKind = 'task' | 'control' | 'subflow';

export type WorkflowExecutionStatus =
  | 'created'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled';

export type WorkflowStepExecutionStatus =
  | 'created'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped';

export interface WorkflowRetryPolicy {
  maxRetries?: number;
  delayMs?: number;
}

export interface WorkflowNodeDefinition {
  id: string;
  name?: string;
  description?: string;
  kind: WorkflowNodeKind;
  type: string;
  disabled?: boolean;
  timeoutMs?: number;
  retryPolicy?: WorkflowRetryPolicy;
  onError?: 'fail' | 'continue';
  configuration?: Record<string, any>;
  metadata?: Record<string, any>;
  children?: WorkflowNodeDefinition[];
  nodes?: WorkflowNodeDefinition[];
  then?: WorkflowNodeDefinition[];
  else?: WorkflowNodeDefinition[];
  branches?: WorkflowBranchDefinition[];
}

export interface WorkflowBranchDefinition {
  id: string;
  name?: string;
  nodes: WorkflowNodeDefinition[];
}

export interface WorkflowTriggerDefinition {
  id: string;
  name?: string;
  type: string;
  configuration?: Record<string, any>;
  disabled?: boolean;
  metadata?: Record<string, any>;
}

export interface WorkflowDefinitionJson {
  version?: string;
  description?: string;
  inputs?: Record<string, any>;
  variables?: Record<string, any>;
  nodes: WorkflowNodeDefinition[];
  triggers?: WorkflowTriggerDefinition[];
  metadata?: Record<string, any>;
}

export interface WorkflowNodeProviderMetadata {
  type: string;
  kind: WorkflowNodeKind;
  category?: string;
  label?: string;
  description?: string;
  configSchema?: Record<string, any>;
  uiSchema?: Record<string, any>;
}

export interface WorkflowNodeHandlerResult {
  status?: WorkflowStepExecutionStatus;
  output?: any;
  artifacts?: WorkflowArtifactEmitRequest[];
}

export interface WorkflowLogEmitRequest {
  level?: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  eventType?: string;
  source?: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface WorkflowArtifactEmitRequest {
  name: string;
  description?: string;
  artifactType?: string;
  uri?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  payload?: any;
  metadata?: Record<string, any>;
}

export interface WorkflowExpressionResolver {
  interpolate<T = any>(value: T, context: WorkflowRuntimeContext): T;
  evaluateCondition(expression: any, context: WorkflowRuntimeContext): boolean;
  resolveExpression(expression: string, context: WorkflowRuntimeContext): any;
}

export interface WorkflowRuntimeContext {
  execution: WorkflowExecution;
  stepExecution?: WorkflowStepExecution;
  node?: WorkflowNodeDefinition;
  input: Record<string, any>;
  variables: Record<string, any>;
  outputs: Record<string, any>;
  counters?: {
    step: number;
    log: number;
  };
  item?: any;
  index?: number;
  parentNodeId?: string;
  parentStepExecutionKey?: string;
}

export interface WorkflowNodeExecutionContext extends WorkflowRuntimeContext {
  node: WorkflowNodeDefinition;
  stepExecution: WorkflowStepExecution;
  expression: WorkflowExpressionResolver;
  runNodes(
    nodes: WorkflowNodeDefinition[],
    options?: Partial<WorkflowRuntimeContext>,
  ): Promise<Record<string, any>>;
  emitLog(entry: WorkflowLogEmitRequest): Promise<void>;
  emitArtifact(entry: WorkflowArtifactEmitRequest): Promise<void>;
}

export interface WorkflowExecutionRequest {
  input?: Record<string, any>;
  variables?: Record<string, any>;
  triggerType?: string;
  requestedByUserId?: number;
}

export interface WorkflowExecutionResponse {
  id: number;
  executionIdentifier: string;
  workflowKey: string;
  status: WorkflowExecutionStatus;
  startedAt: Date;
  finishedAt?: Date;
  durationMs?: number;
  outputPayload?: any;
  errorSummary?: string;
}
