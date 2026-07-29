import { WorkflowExecution } from '../entities/workflow-execution.entity';
import { WorkflowStepExecution } from '../entities/workflow-step-execution.entity';

/**
 * Declares the execution role of a node in the workflow graph.
 *
 * - `task`: performs one unit of work, for example `log.write` or `http.request`.
 * - `control`: owns child-node execution semantics, for example `if`, `parallel`, `sequential`, or `switch`.
 * - `subflow`: reserved for invoking another workflow as a node.
 *
 * Example:
 * ```yaml
 * kind: control
 * type: if
 * ```
 */
export type WorkflowNodeKind = 'task' | 'control' | 'subflow';

/**
 * Describes the logical value type of a configurable node field.
 *
 * This powers schema-driven authoring UI, validation messaging, docs badges, and future field-editor selection.
 *
 * Example:
 * ```yaml
 * configuration:
 *   uri: "{{ variables.defaultUrl }}" # valueType: uri, expressionAllowed: true
 * ```
 */
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

/** Lifecycle status for an entire workflow execution. */
export type WorkflowExecutionStatus =
  | 'enqueued'
  | 'created'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled';

/** Lifecycle status for one node execution inside a workflow execution. */
export type WorkflowStepExecutionStatus =
  | 'created'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped';

/**
 * Retry behavior attached to a node instance in the workflow YAML.
 *
 * This belongs to the editable runtime surface when a node provider sets
 * `authoring.supportsRetryPolicy`.
 *
 * Example:
 * ```yaml
 * retryPolicy:
 *   maxRetries: 3
 *   delayMs: 1000
 * ```
 */
export interface WorkflowRetryPolicy {
  /** Maximum number of retry attempts after the initial failure. */
  maxRetries?: number;

  /** Delay between retry attempts in milliseconds. */
  delayMs?: number;
}

/**
 * A concrete node instance inside `WorkflowDefinitionDsl.nodes` or inside a
 * control node child slot.
 *
 * This is the author-facing DSL shape saved in `definitionYaml`. The topology
 * renderer interprets `kind`, `type`, and child-slot keys (`tasks`, `then`,
 * `else`, `cases`, `defaults`) to draw the graph dynamically. The edit modal
 * exposes common fields plus `configuration` fields declared by the matching
 * `WorkflowNodeProviderMetadata.authoring` metadata.
 *
 * Example:
 * ```yaml
 * - id: check_status
 *   name: Check status
 *   kind: control
 *   type: if
 *   configuration:
 *     condition: "{{ outputs.http_request.code != 200 }}"
 *   then:
 *     - id: alert
 *       kind: task
 *       type: log.write
 *       configuration:
 *         message: Server is down
 * ```
 */
export interface WorkflowNodeDefinition {
  /** Stable unique identifier for output lookup, execution tracking, and UI mutations. */
  id: string;

  /** Optional display label for the node card; UI can fall back to `id`. */
  name?: string;

  /** Optional human-readable note explaining what this node does. */
  description?: string;

  /** Declares whether this is a work node, control-flow node, or subflow node. */
  kind: WorkflowNodeKind;

  /**
   * Provider type key used to resolve execution handler, schema, docs, icon, and
   * authoring metadata. Examples: `log.write`, `http.request`, `if`, `switch`.
   */
  type: string;

  /** When true, the engine skips this node at runtime. */
  disabled?: boolean;

  /** Optional node execution timeout in milliseconds. */
  timeoutMs?: number;

  /** Optional retry policy for failed task execution. */
  retryPolicy?: WorkflowRetryPolicy;

  /** Error behavior: `fail` stops the workflow; `continue` moves to the next node. */
  onError?: 'fail' | 'continue';

  /**
   * Provider-specific input properties for this node.
   *
   * Think of this as the node's input payload: each provider declares which
   * properties it accepts, and the schema-driven form writes those properties
   * into this object using `WorkflowNodeConfigurationFieldDefinition.path` or
   * `.key`.
   *
   * Values may be literals or expression strings. When expressions are allowed
   * for a field, the runtime evaluates them against workflow context before the
   * node handler receives the effective input value.
   *
   * Example for `type: http.request`:
   * ```yaml
   * configuration:
   *   method: GET
   *   uri: "{{ variables.defaultUrl }}"
   * ```
   */
  configuration?: Record<string, any>;

  /** Non-runtime custom annotations for tooling and future extensions. */
  metadata?: Record<string, any>;

  /**
   * Ordered child nodes for control nodes that own a generic task collection.
   *
   * Used by grouping controls such as `sequential` and `parallel`, and also by
   * loop-style controls where the same child task collection is executed for
   * each item or iteration. The control node defines the execution semantics;
   * this property defines the child nodes that participate.
   *
   * Example for `type: sequential`:
   * ```yaml
   * tasks:
   *   - id: first
   *     kind: task
   *     type: log.write
   *   - id: second
   *     kind: task
   *     type: log.write
   * ```
   */
  tasks?: WorkflowNodeDefinition[];

  /**
   * Child nodes executed when an `if` control node condition resolves truthy.
   *
   * Example:
   * ```yaml
   * then:
   *   - id: server_unreachable_alert
   *     kind: task
   *     type: log.write
   * ```
   */
  then?: WorkflowNodeDefinition[];

  /** Child nodes executed when an `if` control node condition resolves falsey. */
  else?: WorkflowNodeDefinition[];

  /** Child nodes executed when no `switch.cases` entry matches the switch value. */
  defaults?: WorkflowNodeDefinition[];

  /** Child nodes executed when this node or its child subtree fails. */
  errors?: WorkflowNodeDefinition[];

  /**
   * Named child-node collections for `switch`.
   *
   * Keys are case values. Values are the nodes that run when the evaluated switch
   * value matches that key.
   *
   * Example:
   * ```yaml
   * cases:
   *   true:
   *     - id: is_true
   *       kind: task
   *       type: log.write
   *   false:
   *     - id: is_false
   *       kind: task
   *       type: log.write
   * ```
   */
  cases?: Record<string, WorkflowNodeDefinition[]>;
}

/**
 * A workflow trigger definition.
 *
 * Triggers start workflow executions, but they are not part of the main node
 * sequence rendered in topology.
 */
export interface WorkflowTriggerDefinition {
  /** Stable trigger id within the workflow. */
  id: string;

  /** Optional display label for UI surfaces. */
  name?: string;

  /** Trigger provider key, for example a schedule trigger type. */
  type: string;

  /** Provider-specific trigger settings. */
  configuration?: Record<string, any>;

  /** When true, the trigger is defined but inactive. */
  disabled?: boolean;

  /** Custom annotations for trigger tooling. */
  metadata?: Record<string, any>;
}

/**
 * Root workflow DSL document saved as YAML.
 *
 * Rendering phases are:
 * 1. fetch `definitionYaml`;
 * 2. parse YAML into this shape;
 * 3. validate this shape and all nested nodes;
 * 4. render topology using node provider metadata and child-slot rules.
 *
 * Example:
 * ```yaml
 * version: 1.0.0
 * variables:
 *   defaultUrl: https://example.com
 * nodes:
 *   - id: start
 *     kind: task
 *     type: log.write
 * ```
 */
export interface WorkflowDefinitionDsl {
  /** DSL version of this workflow definition. */
  version?: string;

  /** Workflow-level markdown/plaintext description for humans. */
  description?: string;

  /** Workflow input declarations or defaults. */
  inputs?: Record<string, any>;

  /** Workflow-scoped reusable values available to expressions. */
  variables?: Record<string, any>;

  /** Top-level executable node sequence. */
  nodes: WorkflowNodeDefinition[];

  /** Optional workflow triggers that can create executions. */
  triggers?: WorkflowTriggerDefinition[];

  /** Workflow-level error handler nodes executed sequentially when execution fails. */
  errors?: WorkflowNodeDefinition[];

  /** Workflow-level cleanup nodes executed sequentially after success or failure. */
  finally?: WorkflowNodeDefinition[];

  /** Workflow-level custom annotations for tooling. */
  metadata?: Record<string, any>;
}

/**
 * Provider metadata declared by `@WorkflowNodeProvider(...)`.
 *
 * This is not saved inside workflow YAML. It describes how a `type` behaves,
 * how it is edited, what docs are shown, and what runtime features are enabled.
 *
 * Example provider fragment:
 * ```ts
 * @WorkflowNodeProvider({
 *   type: 'http.request',
 *   kind: 'task',
 *   authoring: {
 *     configurationFields: [{ key: 'uri', required: true, valueType: 'uri' }]
 *   }
 * })
 * ```
 */
export interface WorkflowNodeProviderMetadata {
  /** Provider type key matched by `WorkflowNodeDefinition.type`. */
  type: string;

  /** Node kind supported by this provider. */
  kind: WorkflowNodeKind;

  /** Provider metadata version, independent from workflow DSL version. */
  version?: string;

  /** Top-level palette/docs grouping. */
  category?: string;

  /** Secondary palette/docs grouping. */
  subcategory?: string;

  /** Human label shown in node cards, palettes, dialogs, and docs. */
  label?: string;

  /** Human description shown in docs and selection surfaces. */
  description?: string;

  /** Icon key consumed by the UI icon resolver. */
  icon?: string;

  /** Search/filter tags for palette and docs surfaces. */
  tags?: string[];

  /** Alternate type/search labels accepted for discovery. */
  aliases?: string[];

  /** Machine schema for node configuration validation. */
  configSchema?: Record<string, any>;

  /** Optional schema hints for configuration UI. */
  uiSchema?: Record<string, any>;

  /** Machine schema describing the node output payload. */
  outputSchema?: Record<string, any>;

  /** Documentation examples shown in node docs. */
  examples?: WorkflowNodeExampleDefinition[];

  /** Runtime metrics emitted or documented by the node. */
  metrics?: WorkflowNodeMetricDefinition[];

  /** Reference material for docs, such as expression variables or output fields. */
  definitions?: WorkflowNodeReferenceDefinition[];

  /** Authoring metadata that defines the editable surface for this node type. */
  authoring?: WorkflowNodeAuthoringMetadata;

  /** Runtime capability metadata used by execution tooling and docs. */
  runtime?: WorkflowNodeRuntimeMetadata;

  /** Human documentation metadata. */
  documentation?: WorkflowNodeDocumentationMetadata;

  /** UI integration metadata for custom editors, docs, palette, and layout hints. */
  ui?: WorkflowNodeUiMetadata;
}

/**
 * Declares which parts of a node are editable in generic authoring UI.
 *
 * This metadata is what the topology edit/add modal reads to decide which common
 * fields, configuration fields, and child-slot affordances to expose.
 */
export interface WorkflowNodeAuthoringMetadata {
  /** Initial `configuration` object for a newly added node. */
  defaultConfiguration?: Record<string, any>;

  /** Schema-driven editable fields that write to `node.configuration`. */
  configurationFields?: WorkflowNodeConfigurationFieldDefinition[];

  /** Optional higher-level layout for configuration fields. */
  configurationLayout?: WorkflowNodeConfigurationLayoutDefinition;

  /** Child collections owned by this node when `kind: control`. */
  childSlots?: WorkflowNodeChildSlotDefinition[];

  /** Documented or typed outputs produced by this node. */
  outputs?: WorkflowNodeOutputDefinition[];

  /** Whether this node generally supports expression values. */
  supportsExpressions?: boolean;

  /** Expose `retryPolicy` in the edit modal. */
  supportsRetryPolicy?: boolean;

  /** Expose `timeoutMs` in the edit modal. */
  supportsTimeoutMs?: boolean;

  /** Expose `onError` in the edit modal. */
  supportsOnError?: boolean;

  /** Expose `disabled` in the edit modal. */
  supportsDisableToggle?: boolean;

  /** Expose the common `name` field in the edit modal. */
  supportsName?: boolean;

  /** Expose the common `description` field in the edit modal. */
  supportsDescription?: boolean;

  /** Extra searchable text for palette and docs discovery. */
  searchableText?: string[];
}

/** Declarative layout for schema-driven node configuration fields. */
export interface WorkflowNodeConfigurationLayoutDefinition {
  /** Layout strategy. Only `tabs` is currently implemented by the generic UI. */
  type: 'tabs';

  /** Tab definitions. Fields not assigned to a tab should fall back to `Other`. */
  tabs: WorkflowNodeConfigurationLayoutTabDefinition[];
}

/** One configuration tab. Tabs may include explicit fields and/or whole groups. */
export interface WorkflowNodeConfigurationLayoutTabDefinition {
  /** Stable tab key. */
  key: string;

  /** Human label shown in the editor. */
  label: string;

  /** Field keys or field paths to include in this tab. */
  fields?: string[];

  /** Group labels to include in this tab. */
  groups?: string[];
}

/**
 * Describes a control node child collection that can be edited from topology.
 *
 * Child slots tell the renderer and mutation layer which node property contains
 * child nodes and how those children should be arranged.
 *
 * Example for `if`:
 * ```ts
 * { key: 'then', label: 'Then', kind: 'sequence', layout: 'sequential' }
 * ```
 *
 * Example for `switch`:
 * ```ts
 * { key: 'cases', label: 'Cases', kind: 'case-collection', layout: 'parallel' }
 * ```
 */
export interface WorkflowNodeChildSlotDefinition {
  /** Property key on `WorkflowNodeDefinition`, for example `tasks`, `then`, `else`, `cases`. */
  key: string;

  /** Human label shown in topology or editor summaries. */
  label?: string;

  /** Human explanation of what this child slot means. */
  description?: string;

  /**
   * Shape of child data.
   *
   * `sequence` means the property is `WorkflowNodeDefinition[]`.
   * `case-collection` means the property is `Record<string, WorkflowNodeDefinition[]>`.
   */
  kind: 'sequence' | 'case-collection';

  /**
   * Preferred visual arrangement for children in this slot.
   *
   * `sequential` renders top-to-bottom. `parallel` renders peer lines side-by-side.
   */
  layout?: 'sequential' | 'parallel';

  /** Whether a valid node instance should contain this child slot. */
  required?: boolean;

  /** Minimum allowed children or cases. */
  minItems?: number;

  /** Maximum allowed children or cases. */
  maxItems?: number;
}

/**
 * Describes one editable field in `WorkflowNodeDefinition.configuration`.
 *
 * These definitions drive the generic schema-based add/edit modal. They are the
 * bridge between provider metadata and the user-editable YAML.
 *
 * Example:
 * ```ts
 * { key: 'uri', label: 'URI', valueType: 'uri', required: true }
 * ```
 * writes:
 * ```yaml
 * configuration:
 *   uri: https://example.com
 * ```
 */
export interface WorkflowNodeConfigurationFieldDefinition {
  /** Stable field key and default path within `configuration`. */
  key: string;

  /** Human label shown above the form field. */
  label?: string;

  /** Help text shown below or near the field. */
  description?: string;

  /** Logical type used for validation, docs badges, and default editor selection. */
  valueType?: WorkflowNodeConfigurationValueType;

  /** Whether this field must be present for a valid node configuration. */
  required?: boolean;

  /** Dot-path override inside `configuration`; defaults to `key`. */
  path?: string;

  /** Whether the field supports expression strings like `{{ inputs.value }}`. */
  expressionAllowed?: boolean;

  /** Whether the field supports secret references or secret handling. */
  secretAllowed?: boolean;

  /** Initial value used when creating a new node of this type. */
  defaultValue?: any;

  /** Fixed option list rendered as a select-like control. */
  enumValues?: Array<string | number | boolean>;

  /** Example values for docs and future inline help. */
  examples?: any[];

  /** Form grouping label used to visually cluster related fields. */
  group?: string;

  /** Preferred generic widget, for example `textarea`, `yaml-editor`, or `json-editor`. */
  widgetHint?: string;

  /** Custom field editor component registry key. */
  extensionComponentKey?: string;

  /** Optional machine schema for this specific field. */
  schema?: Record<string, any>;

  /** Optional UI schema for this specific field. */
  uiSchema?: Record<string, any>;
}

/** Describes one output value produced by a node provider. */
export interface WorkflowNodeOutputDefinition {
  /** Stable output key. */
  key: string;

  /** Human label for docs. */
  label?: string;

  /** Human explanation of the output. */
  description?: string;

  /** Logical value type of the output. */
  valueType?: WorkflowNodeConfigurationValueType;

  /** Dot path inside the runtime output object. */
  path?: string;

  /** Whether the output is expected on successful execution. */
  required?: boolean;

  /**
   * Whether this output is added to `outputs.<nodeId>` for downstream expressions.
   * Defaults to true. Set false for observability-only outputs that should be
   * stored on the step execution but not suggested or exposed to later nodes.
   */
  includeInRuntimeContext?: boolean;

  /** Optional machine schema for this output value. */
  schema?: Record<string, any>;
}

/** Documents a runtime metric associated with a node provider. */
export interface WorkflowNodeMetricDefinition {
  /** Stable metric key. */
  key: string;

  /** Human label for docs. */
  label?: string;

  /** Human explanation of the metric. */
  description?: string;

  /** Metric shape. */
  type?: 'counter' | 'gauge' | 'histogram' | 'timer' | 'summary';

  /** Unit label, for example `ms`, `bytes`, or `count`. */
  unit?: string;

  /** Dot path if derived from output or execution context. */
  path?: string;

  /** Metric tags emitted with the value. */
  tags?: string[];
}

/** Example snippet shown in node documentation. */
export interface WorkflowNodeExampleDefinition {
  /** Stable example key. */
  key: string;

  /** Human example title. */
  label?: string;

  /** Short explanation of what the example demonstrates. */
  description?: string;

  /** Snippet language for syntax highlighting. */
  language?: 'json' | 'yaml' | 'javascript' | 'typescript' | 'text';

  /** The example source text. */
  snippet: string;

  /** True when the snippet only represents `configuration`, not a full node. */
  configurationOnly?: boolean;

  /** Custom annotations for docs tooling. */
  metadata?: Record<string, any>;
}

/** Additional reference block shown in node documentation. */
export interface WorkflowNodeReferenceDefinition {
  /** Stable reference key. */
  key: string;

  /** Human reference title. */
  label?: string;

  /** Short explanation of the reference. */
  description?: string;

  /** Main reference content. */
  content?: string;

  /** Examples attached to this reference block. */
  examples?: WorkflowNodeExampleDefinition[];

  /** Optional machine schema for referenced data. */
  schema?: Record<string, any>;

  /** Custom annotations for docs tooling. */
  metadata?: Record<string, any>;
}

/** Runtime capability metadata for a node provider. */
export interface WorkflowNodeRuntimeMetadata {
  /** Whether the node commonly emits log entries. */
  emitsLogs?: boolean;

  /** Whether the node may emit artifacts. */
  emitsArtifacts?: boolean;

  /** Whether the same input should produce stable output. */
  deterministicOutputs?: boolean;

  /** Whether execution is a normal task handler or engine-orchestrated control flow. */
  executionMode?: 'task' | 'engine-controlled';

  /** Statuses considered successful for this node type. */
  successStatuses?: WorkflowStepExecutionStatus[];
}

/** Human-facing documentation metadata for a node provider. */
export interface WorkflowNodeDocumentationMetadata {
  /** Short docs summary shown in node documentation surfaces. */
  summary?: string;
}

/** UI integration metadata for node authoring and documentation. */
export interface WorkflowNodeUiMetadata {
  /** Icon key used by topology cards, palette items, and docs. */
  icon?: string;

  /** Icon foreground color used by palette/dialog/topology surfaces. */
  iconColor?: string;

  /** Icon tile background color used by palette/dialog/topology surfaces. */
  iconBackgroundColor?: string;

  /** Optional icon tile border color for richer palette treatments. */
  iconBorderColor?: string;

  /** Custom full-node editor component registry key. */
  editorComponentKey?: string;

  /** Custom documentation component registry key. */
  docsComponentKey?: string;

  /** Custom palette item component registry key. */
  paletteComponentKey?: string;

  /** Default edit mode: generic schema form or custom editor. */
  defaultEditorMode?: 'schema' | 'custom';

  /** Per-field custom editor component registry keys keyed by configuration field key. */
  fieldComponentKeys?: Record<string, string>;

  /** Preferred modal size for add/edit UI. */
  modalSize?: 'sm' | 'md' | 'lg' | 'xl' | 'full';

  /** Optional visual hints for docs/editor/topology layout. */
  layoutHints?: {
    /** Preferred workflow page panel when this node is focused. */
    preferredPanel?: 'code' | 'flow' | 'docs';

    /** Preferred order for configuration field groups. */
    groupOrder?: string[];

    /** Whether a summary should remain visible while editing long forms. */
    stickySummary?: boolean;
  };
}

/**
 * Serialized provider metadata returned to the frontend.
 *
 * This intentionally mirrors `WorkflowNodeProviderMetadata` so the UI can render
 * the palette, docs modal, topology cards, and add/edit dialog without importing
 * backend provider classes.
 */
export interface WorkflowNodeMetadataResponse {
  /** Provider type key matched by `WorkflowNodeDefinition.type`. */
  type: string;

  /** Node kind supported by this provider. */
  kind: WorkflowNodeKind;

  /** Provider metadata version. */
  version?: string;

  /** Top-level palette/docs grouping. */
  category?: string;

  /** Secondary palette/docs grouping. */
  subcategory?: string;

  /** Human label shown in UI. */
  label?: string;

  /** Human description shown in UI. */
  description?: string;

  /** Icon key consumed by the UI icon resolver. */
  icon?: string;

  /** Search/filter tags. */
  tags?: string[];

  /** Machine schema for node configuration validation. */
  configSchema?: Record<string, any>;

  /** Optional schema hints for configuration UI. */
  uiSchema?: Record<string, any>;

  /** Machine schema describing node output payload. */
  outputSchema?: Record<string, any>;

  /** Documentation examples. */
  examples?: WorkflowNodeExampleDefinition[];

  /** Runtime metrics. */
  metrics?: WorkflowNodeMetricDefinition[];

  /** Reference docs blocks. */
  definitions?: WorkflowNodeReferenceDefinition[];

  /** Authoring metadata consumed by generic UI. */
  authoring?: WorkflowNodeAuthoringMetadata;

  /** Runtime capability metadata. */
  runtime?: WorkflowNodeRuntimeMetadata;

  /** Human documentation metadata. */
  documentation?: WorkflowNodeDocumentationMetadata;

  /** UI integration metadata. */
  ui?: WorkflowNodeUiMetadata;
}

/** Return value from a node execution handler. */
export interface WorkflowNodeHandlerResult {
  /** Final step status; defaults are inferred when omitted. */
  status?: WorkflowStepExecutionStatus;

  /** Output payload stored under this node id for downstream expressions. */
  output?: any;

  /** Artifacts emitted by this node execution. */
  artifacts?: WorkflowArtifactEmitRequest[];
}

/** Log entry emitted by node handlers during workflow execution. */
export interface WorkflowLogEmitRequest {
  /** Log level. */
  level?: 'debug' | 'info' | 'warn' | 'error';

  /** Human log message. */
  message: string;

  /** Optional structured event type. */
  eventType?: string;

  /** Optional source label, usually node/provider related. */
  source?: string;

  /** Structured context values for querying/debugging. */
  context?: Record<string, any>;

  /** Custom annotations for log consumers. */
  metadata?: Record<string, any>;
}

/** Artifact emitted by a node execution. */
export interface WorkflowArtifactEmitRequest {
  /** Human or stable artifact name. */
  name: string;

  /** Human explanation of the artifact. */
  description?: string;

  /** Logical artifact kind, for example `file`, `json`, or `report`. */
  artifactType?: string;

  /** URI where the artifact can be fetched. */
  uri?: string;

  /** File name when the artifact maps to a file. */
  fileName?: string;

  /** MIME type when known. */
  mimeType?: string;

  /** Artifact size in bytes when known. */
  sizeBytes?: number;

  /** Optional checksum for integrity checks. */
  checksum?: string;

  /** Inline payload for small artifacts. */
  payload?: any;

  /** Custom annotations for artifact consumers. */
  metadata?: Record<string, any>;
}

/** Expression service available to node handlers. */
export interface WorkflowExpressionResolver {
  /** Recursively interpolates expression strings inside a value. */
  interpolate<T = any>(value: T, context: WorkflowRuntimeContext): T;

  /** Evaluates a condition-like expression to a boolean. */
  evaluateCondition(expression: any, context: WorkflowRuntimeContext): boolean;

  /** Resolves one expression string against runtime context. */
  resolveExpression(expression: string, context: WorkflowRuntimeContext): any;
}

/** Loop context exposed to expressions for nested itemized controls. */
export interface WorkflowLoopContext {
  /** Current item for this loop frame. */
  item: any;

  /** Zero-based iteration index for this loop frame. */
  index: number;

  /** Loop control node id. */
  nodeId?: string;

  /** Loop control step execution key. */
  stepExecutionKey?: string;
}

/** Runtime context shared by workflow execution and node execution. */
export interface WorkflowRuntimeContext {
  /** Parent workflow execution entity. */
  execution: WorkflowExecution;

  /** Current step execution, when inside a node handler. */
  stepExecution?: WorkflowStepExecution;

  /** Current node definition, when inside a node handler. */
  node?: WorkflowNodeDefinition;

  /** Input values supplied when execution was requested. */
  input: Record<string, any>;

  /** Workflow variables from DSL plus request-time overrides. */
  variables: Record<string, any>;

  /** Decrypted global secrets available to workflow expressions. */
  secrets?: Record<string, any>;

  /** Outputs keyed by node id. */
  outputs: Record<string, any>;

  /** Internal counters used to generate stable execution/log ordering. */
  counters?: {
    /** Step counter. */
    step: number;

    /** Log counter. */
    log: number;
  };

  /** Current item for itemized/iterative control nodes. */
  item?: any;

  /** Current item index for itemized/iterative control nodes. */
  index?: number;

  /** Nearest parent loop frame, when inside nested loop children. */
  parent?: WorkflowLoopContext;

  /** Parent loop frames, nearest first. */
  parents?: WorkflowLoopContext[];

  /** Loop frames from outermost to innermost, including the current loop. */
  loops?: WorkflowLoopContext[];

  /** Current error context when executing an error handler. */
  error?: any;

  /** Parent control node id when executing nested child nodes. */
  parentNodeId?: string;

  /** Parent step execution key when executing nested child nodes. */
  parentStepExecutionKey?: string;
}

/**
 * Node-handler execution context.
 *
 * This extends runtime context with guaranteed current-node values, expression
 * helpers, nested execution helpers, and emitters.
 */
export interface WorkflowNodeExecutionContext extends WorkflowRuntimeContext {
  /** Current node definition being executed. */
  node: WorkflowNodeDefinition;

  /** Current step execution entity. */
  stepExecution: WorkflowStepExecution;

  /** Expression helper bound to the current runtime context. */
  expression: WorkflowExpressionResolver;

  /** Execute child nodes with optional context overrides. Used by control nodes. */
  runNodes(
    nodes: WorkflowNodeDefinition[],
    options?: Partial<WorkflowRuntimeContext>,
  ): Promise<Record<string, any>>;

  /** Emit a structured log entry for this node execution. */
  emitLog(entry: WorkflowLogEmitRequest): Promise<void>;

  /** Emit an artifact for this node execution. */
  emitArtifact(entry: WorkflowArtifactEmitRequest): Promise<void>;
}

/** Request payload for starting a workflow execution. */
export interface WorkflowExecutionRequest {
  /** Input values supplied by caller. */
  input?: Record<string, any>;

  /** Variable overrides supplied by caller. */
  variables?: Record<string, any>;

  /** Trigger source/type if execution was trigger-created. */
  triggerType?: string;

  /** User id responsible for the request, when available. */
  requestedByUserId?: number;
}

/** API response describing a workflow execution. */
export interface WorkflowExecutionResponse {
  /** Database id. */
  id: number;

  /** Public/stable execution identifier. */
  executionIdentifier: string;

  /** Workflow key that was executed. */
  workflowKey: string;

  /** Current or final execution status. */
  status: WorkflowExecutionStatus;

  /** Execution start timestamp. */
  startedAt: Date;

  /** Execution finish timestamp, if completed. */
  finishedAt?: Date;

  /** Execution duration in milliseconds, if completed. */
  durationMs?: number;

  /** Final workflow output payload. */
  outputPayload?: any;

  /** Human-readable failure summary, when failed. */
  errorSummary?: string;
}
