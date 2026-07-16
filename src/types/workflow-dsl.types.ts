import { WorkflowExecution } from '../entities/workflow-execution.entity';
import { WorkflowStepExecution } from '../entities/workflow-step-execution.entity';

export type WorkflowNodeKind = 'task' | 'control' | 'subflow';

export type WorkflowNodeConfigurationValueType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'json'
  | 'secret'
  | 'expression'
  | 'relation'
  | 'uri'
  | 'any';

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
  tasks?: WorkflowNodeDefinition[];
  then?: WorkflowNodeDefinition[];
  else?: WorkflowNodeDefinition[];
  defaults?: WorkflowNodeDefinition[];
  cases?: Record<string, WorkflowNodeDefinition[]>;
}

export interface WorkflowTriggerDefinition {
  id: string;
  name?: string;
  type: string;
  configuration?: Record<string, any>;
  disabled?: boolean;
  metadata?: Record<string, any>;
}

export interface WorkflowDefinitionDsl {
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
  version?: string;
  category?: string;
  subcategory?: string;
  label?: string;
  description?: string;
  icon?: string;
  tags?: string[];
  aliases?: string[];
  configSchema?: Record<string, any>;
  uiSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  examples?: WorkflowNodeExampleDefinition[];
  metrics?: WorkflowNodeMetricDefinition[];
  definitions?: WorkflowNodeReferenceDefinition[];
  authoring?: WorkflowNodeAuthoringMetadata;
  runtime?: WorkflowNodeRuntimeMetadata;
  documentation?: WorkflowNodeDocumentationMetadata;
  ui?: WorkflowNodeUiMetadata;
}

export interface WorkflowNodeChildSlotDefinition {
  key: string;
  label?: string;
  description?: string;
  kind: 'sequence' | 'case-collection';
  layout?: 'sequential' | 'parallel';
  required?: boolean;
  minItems?: number;
  maxItems?: number;
}

export interface WorkflowNodeConfigurationFieldDefinition {
  key: string;
  label?: string;
  description?: string;
  valueType?: WorkflowNodeConfigurationValueType;
  required?: boolean;
  path?: string;
  expressionAllowed?: boolean;
  secretAllowed?: boolean;
  defaultValue?: any;
  enumValues?: Array<string | number | boolean>;
  examples?: any[];
  group?: string;
  widgetHint?: string;
  extensionComponentKey?: string;
  schema?: Record<string, any>;
  uiSchema?: Record<string, any>;
}

export interface WorkflowNodeOutputDefinition {
  key: string;
  label?: string;
  description?: string;
  valueType?: WorkflowNodeConfigurationValueType;
  path?: string;
  required?: boolean;
  schema?: Record<string, any>;
}

export interface WorkflowNodeMetricDefinition {
  key: string;
  label?: string;
  description?: string;
  type?: 'counter' | 'gauge' | 'histogram' | 'timer' | 'summary';
  unit?: string;
  path?: string;
  tags?: string[];
}

export interface WorkflowNodeExampleDefinition {
  key: string;
  label?: string;
  description?: string;
  language?: 'json' | 'yaml' | 'javascript' | 'typescript' | 'text';
  snippet: string;
  configurationOnly?: boolean;
  metadata?: Record<string, any>;
}

export interface WorkflowNodeReferenceDefinition {
  key: string;
  label?: string;
  description?: string;
  content?: string;
  examples?: WorkflowNodeExampleDefinition[];
  schema?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface WorkflowNodeAuthoringMetadata {
  defaultConfiguration?: Record<string, any>;
  configurationFields?: WorkflowNodeConfigurationFieldDefinition[];
  childSlots?: WorkflowNodeChildSlotDefinition[];
  outputs?: WorkflowNodeOutputDefinition[];
  supportsExpressions?: boolean;
  supportsRetryPolicy?: boolean;
  supportsTimeoutMs?: boolean;
  supportsOnError?: boolean;
  supportsDisableToggle?: boolean;
  supportsName?: boolean;
  supportsDescription?: boolean;
  searchableText?: string[];
}

export interface WorkflowNodeRuntimeMetadata {
  emitsLogs?: boolean;
  emitsArtifacts?: boolean;
  deterministicOutputs?: boolean;
  executionMode?: 'task' | 'engine-controlled';
  successStatuses?: WorkflowStepExecutionStatus[];
}

export interface WorkflowNodeDocumentationMetadata {
  summary?: string;
}

export interface WorkflowNodeUiMetadata {
  icon?: string;
  editorComponentKey?: string;
  docsComponentKey?: string;
  paletteComponentKey?: string;
  defaultEditorMode?: 'schema' | 'custom';
  fieldComponentKeys?: Record<string, string>;
  modalSize?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  layoutHints?: {
    preferredPanel?: 'code' | 'flow' | 'docs';
    groupOrder?: string[];
    stickySummary?: boolean;
  };
}

export interface WorkflowNodeMetadataResponse {
  type: string;
  kind: WorkflowNodeKind;
  version?: string;
  category?: string;
  subcategory?: string;
  label?: string;
  description?: string;
  icon?: string;
  tags?: string[];
  configSchema?: Record<string, any>;
  uiSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  examples?: WorkflowNodeExampleDefinition[];
  metrics?: WorkflowNodeMetricDefinition[];
  definitions?: WorkflowNodeReferenceDefinition[];
  authoring?: WorkflowNodeAuthoringMetadata;
  runtime?: WorkflowNodeRuntimeMetadata;
  documentation?: WorkflowNodeDocumentationMetadata;
  ui?: WorkflowNodeUiMetadata;
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
