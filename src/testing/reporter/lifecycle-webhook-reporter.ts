import { randomUUID } from "crypto";

import { ConsoleReporter } from "./console-reporter";
import type { IArtifactSink } from "./artifact-sink";
import type {
  ArtifactRef,
  LifecycleEnvelope,
  LifecycleEventType,
  ScenarioDescriptor,
  ScenarioEndData,
  SetupEndData,
  SetupStartData,
  StepResultData,
  TeardownEndData,
} from "./lifecycle-events.types";
import type { OpStep, ScenarioSpec, ScenarioType, SetupScope } from "../contracts/testing-metadata.types";
import type { StepDataUsed, StepPhase } from "../contracts/runtime-context.types";
import type {
  BlockedBy,
  RunEndArgs,
  ScenarioResult,
  ScenarioSetupInfo,
  ScenarioSkipInfo,
} from "./reporter.types";

/**
 * Pluggable POST function so the reporter stays DI-agnostic. The default uses the
 * global `fetch`; the Nest worker can inject an axios-backed implementation that
 * shares the existing HttpModule stack.
 */
export type WebhookPostFn = (
  url: string,
  body: unknown,
  opts: { headers?: Record<string, string>; timeoutMs?: number },
) => Promise<{ ok: boolean; status: number }>;

export interface LifecycleWebhookReporterOptions {
  webhookUrl: string;
  runName: string;
  /** correlation id supplied by the caller (e.g. testingHub TestRun id). */
  externalRunId?: string;
  /** runner-generated uuid for this process run; auto-generated when omitted. */
  runId?: string;
  /** Phase 2: sink for binary artifacts (screenshots/video/HAR). */
  artifactSink?: IArtifactSink;
  headers?: Record<string, string>;
  post?: WebhookPostFn;
}

const DEFAULT_TIMEOUT_MS = 10_000;
/** Scenario id prefix the runner uses for steps and attachments that belong to a setup, not to a scenario. */
const SETUP_PREFIX = "setup:";
/** Cap inline text artifacts so a webhook body never blows past receiver limits. */
const INLINE_TEXT_CAP = 1_000_000;

function formatError(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error) return err.stack || err.message;
  return String(err);
}

const defaultPost: WebhookPostFn = async (url, body, opts) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  return { ok: res.ok, status: res.status };
};

/** The setup id for a `setup:<id>` scenario id, or undefined for a scenario id. */
function setupIdOf(scenarioId: string): string | undefined {
  return scenarioId.startsWith(SETUP_PREFIX) ? scenarioId.slice(SETUP_PREFIX.length) : undefined;
}

/** Map an `attach()` payload to an ArtifactRef. Covers API/console/network + video/screenshots. */
function classifyAttachment(name: string, contentType: string): ArtifactRef["kind"] {
  const hint = `${name} ${contentType}`.toLowerCase();
  if (name.toLowerCase().endsWith("timeline.json")) return "timeline";
  if (contentType.startsWith("video/") || hint.includes("video")) return "video";
  if (hint.includes("screenshot") || contentType.startsWith("image/")) return "screenshot";
  if (hint.includes("console")) return "console";
  if (hint.includes("network") || hint.includes("har")) return "network";
  if (hint.includes("api")) return "api-log";
  return "api-log";
}

function isBinaryContentType(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return ct.startsWith("image/") || ct.startsWith("video/") || ct === "application/octet-stream";
}

/**
 * Emits incremental lifecycle webhooks (run.start → scenario.start → scenario.end →
 * run.end) to a single URL, while still printing to the console (extends
 * ConsoleReporter). Deliveries are serialized through an async chain so ordering is
 * preserved without blocking step execution, and a failed POST never throws into the
 * run. Distinct from the legacy {@link WebhookReporter}, which only fires once on flush.
 */
export class LifecycleWebhookReporter extends ConsoleReporter {
  private readonly webhookUrl: string;
  private readonly runName: string;
  private readonly externalRunId?: string;
  private readonly runId: string;
  private readonly headers?: Record<string, string>;
  private readonly post: WebhookPostFn;
  /** Phase 2: used to upload binary artifacts in onScenarioEnd. */
  protected readonly artifactSink?: IArtifactSink;

  private seq = 0;
  private startedAtMs = Date.now();
  private total = 0;
  private scenarioIndex = 0;
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private blocked = 0;
  private currentSteps: StepResultData[] = [];
  private currentArtifacts: ArtifactRef[] = [];
  /** Id of the scenario whose scenario.start was sent last. */
  private currentScenarioId?: string;
  /**
   * Ready-check steps that arrived before their scenario's scenario.start (the runner checks the setup before running
   * the scenario). Added to that scenario's steps when it starts, and kept until its end so a retry keeps them.
   */
  private earlyReadySteps = new Map<string, StepResultData[]>();
  /** False when the runner reported a failed run on onRunEnd; run.end then says ok: false. */
  private runnerOk?: boolean;
  /** Setup steps buffered per setup id until that setup's setup.end. */
  private setupSteps = new Map<string, StepResultData[]>();
  /** Setup attachments buffered per setup id; sent on setup.end only when the setup failed. */
  private setupArtifacts = new Map<string, ArtifactRef[]>();
  /** Setup names from run.start, so setup.end can carry a readable name. */
  private setupNames = new Map<string, string>();
  /** Setup info reported for a consumer scenario, sent on that scenario's next scenario.end. */
  private scenarioSetups = new Map<string, ScenarioSetupInfo>();
  /** Run-level artifacts (e.g. the whole-run video); emitted on run.end. */
  private runArtifacts: ArtifactRef[] = [];
  /** Serializes webhook deliveries to preserve order. */
  private chain: Promise<void> = Promise.resolve();

  constructor(opts: LifecycleWebhookReporterOptions) {
    super();
    this.webhookUrl = opts.webhookUrl;
    this.runName = opts.runName;
    this.externalRunId = opts.externalRunId;
    this.runId = opts.runId ?? randomUUID();
    this.artifactSink = opts.artifactSink;
    this.headers = opts.headers;
    this.post = opts.post ?? defaultPost;
  }

  getRunId(): string {
    return this.runId;
  }

  override onRunStart(args: {
    total: number;
    startedAt: string;
    scenarioIds: string[];
    scenarios?: ScenarioDescriptor[];
    setups?: Array<{ id: string; name: string; scope: SetupScope }>;
    order?: "file" | "shuffle";
    shuffleSeed?: string;
  }): void {
    super.onRunStart(args);
    this.total = args.total;
    this.startedAtMs = Date.now();
    for (const setup of args.setups ?? []) this.setupNames.set(setup.id, setup.name);
    this.emit("run.start", {
      total: args.total,
      scenarioIds: args.scenarioIds,
      scenarios: args.scenarios ?? args.scenarioIds.map((id) => ({ id, type: "api" as ScenarioType })),
      startedAt: args.startedAt,
      ...(args.setups?.length ? { setups: args.setups } : {}),
      ...(args.order ? { order: args.order } : {}),
      ...(args.shuffleSeed ? { shuffleSeed: args.shuffleSeed } : {}),
    });
  }

  override onScenarioStart(scenario: ScenarioSpec): void {
    super.onScenarioStart(scenario);
    this.currentScenarioId = scenario.id;
    this.currentSteps = [...(this.earlyReadySteps.get(scenario.id) ?? [])];
    this.currentArtifacts = [];
    const index = this.scenarioIndex++;
    this.emit("scenario.start", {
      scenarioId: scenario.id,
      name: scenario.name,
      type: scenario.type,
      index,
      total: this.total,
    });
  }

  override onStepEnd(args: {
    scenarioId: string;
    phase: StepPhase;
    step: OpStep;
    ok: boolean;
    error?: unknown;
    durationMs: number;
    stepPath?: string;
    slowestCallMs?: number;
    data?: StepDataUsed[];
    setup?: string;
  }): void {
    super.onStepEnd(args);
    const step: StepResultData = {
      phase: String(args.phase),
      operation: args.step.op,
      name: args.step.name,
      ...(args.stepPath ? { stepPath: args.stepPath } : {}),
      ...(args.slowestCallMs ? { slowestCallMs: args.slowestCallMs } : {}),
      ...(args.data?.length ? { data: args.data } : {}),
      ...(args.setup ? { setup: args.setup } : {}),
      ok: args.ok,
      durationMs: args.durationMs,
      error: args.error ? formatError(args.error) : undefined,
    };
    const setupId = setupIdOf(args.scenarioId);
    if (setupId !== undefined) {
      const steps = this.setupSteps.get(setupId) ?? [];
      steps.push(step);
      this.setupSteps.set(setupId, steps);
      return;
    }
    if (args.setup === "ready" && args.scenarioId !== this.currentScenarioId) {
      const early = this.earlyReadySteps.get(args.scenarioId) ?? [];
      early.push(step);
      this.earlyReadySteps.set(args.scenarioId, early);
      return;
    }
    this.currentSteps.push(step);
  }

  override attach(args: {
    scenarioId: string;
    name: string;
    contentType: string;
    data: Buffer | string;
  }): void {
    super.attach(args);
    const kind = classifyAttachment(args.name, args.contentType);
    const binary = Buffer.isBuffer(args.data) && isBinaryContentType(args.contentType);
    const bucket = this.artifactBucketFor(args.scenarioId);

    // Binary artifacts (screenshots, video): when a storage sink is configured, upload the bytes
    // to shared storage and reference them by storageKey/url — never ship blobs inline (the
    // inline cap would silently drop anything large, e.g. a video). The ref is mutated in place
    // by an upload queued onto the delivery chain, so it resolves before scenario.end is posted.
    if (binary && this.artifactSink) {
      const buf = args.data as Buffer;
      const artifact: ArtifactRef = {
        kind,
        name: args.name,
        contentType: args.contentType,
        transport: "storage",
        sizeBytes: buf.byteLength,
      };
      bucket.push(artifact);
      const runId = this.externalRunId ?? this.runId;
      const scenarioId = args.scenarioId;
      this.chain = this.chain
        .then(async () => {
          const ref = await this.artifactSink!.put({
            runId,
            scenarioId,
            name: args.name,
            contentType: args.contentType,
            data: buf,
          });
          artifact.storageKey = ref.storageKey;
          artifact.url = ref.url;
        })
        .catch(() => {
          /* upload failed — leave the ref without a key; the ingest side skips empty refs */
        });
      return;
    }

    if (binary) {
      // Binary (e.g. a screenshot JPEG): base64-encode — a utf8 decode would corrupt the
      // bytes. Truncating base64 also corrupts it, so if it somehow exceeds the inline cap
      // we drop the payload rather than ship a broken image (viewport JPEGs stay well under).
      const bytes = args.data as Buffer;
      const base64 = bytes.toString("base64");
      const artifact: ArtifactRef = {
        kind,
        name: args.name,
        contentType: args.contentType,
        transport: "inline",
        sizeBytes: bytes.byteLength,
      };
      if (base64.length <= INLINE_TEXT_CAP) {
        artifact.inlineData = base64;
      }
      bucket.push(artifact);
      return;
    }

    const text = Buffer.isBuffer(args.data)
      ? args.data.toString("utf8")
      : String(args.data ?? "");
    bucket.push({
      kind,
      name: args.name,
      contentType: args.contentType,
      transport: "inline",
      inlineData: text.length > INLINE_TEXT_CAP ? text.slice(0, INLINE_TEXT_CAP) : text,
      sizeBytes: Buffer.byteLength(text),
    });
  }

  override onScenarioEnd(
    scenario: ScenarioSpec,
    result: ScenarioResult,
  ): void {
    super.onScenarioEnd(scenario, result);
    if (result.ok) {
      this.passed += 1;
    } else {
      this.failed += 1;
    }
    const setup = this.scenarioSetups.get(scenario.id);
    this.scenarioSetups.delete(scenario.id);
    this.earlyReadySteps.delete(scenario.id);
    const data: ScenarioEndData = {
      scenarioId: scenario.id,
      name: scenario.name,
      ok: result.ok,
      status: result.ok ? "passed" : "failed",
      durationMs: result.durationMs,
      error: result.error ? formatError(result.error) : undefined,
      steps: [...this.currentSteps],
      artifacts: [...this.currentArtifacts],
      ...(result.heals?.length ? { heals: result.heals } : {}),
      ...(setup ? { setup } : {}),
    };
    this.emit("scenario.end", data);
  }

  override onScenarioBlocked(scenario: ScenarioSpec, blockedBy: BlockedBy): void {
    super.onScenarioBlocked(scenario, blockedBy);
    this.blocked += 1;
    // A blocked scenario never ran: drop anything reported for it so nothing leaks into a later scenario.end.
    this.scenarioSetups.delete(scenario.id);
    this.earlyReadySteps.delete(scenario.id);
    this.currentScenarioId = scenario.id;
    this.currentSteps = [];
    this.currentArtifacts = [];
    const index = this.scenarioIndex++;
    this.emit("scenario.start", {
      scenarioId: scenario.id,
      name: scenario.name,
      type: scenario.type,
      index,
      total: this.total,
    });
    const reason =
      blockedBy.kind === "setup"
        ? `Blocked: setup "${blockedBy.id}" failed`
        : `Blocked: dependency "${blockedBy.id}" did not pass`;
    const data: ScenarioEndData = {
      scenarioId: scenario.id,
      name: scenario.name,
      ok: false,
      status: "blocked",
      blockedBy,
      durationMs: 0,
      error: blockedBy.error ?? reason,
      steps: [],
      artifacts: [],
    };
    this.emit("scenario.end", data);
  }

  onScenarioSetup(scenarioId: string, info: ScenarioSetupInfo): void {
    this.scenarioSetups.set(scenarioId, info);
  }

  override onSetupStart(args: { setupId: string; attempt: number; forScenarioId: string }): void {
    super.onSetupStart(args);
    // A new attempt starts with empty buffers (drops anything a teardown or an earlier attempt left behind).
    this.setupSteps.delete(args.setupId);
    this.setupArtifacts.delete(args.setupId);
    const data: SetupStartData = {
      setupId: args.setupId,
      name: this.setupNames.get(args.setupId) ?? args.setupId,
      attempt: args.attempt,
      forScenarioId: args.forScenarioId,
    };
    this.emit("setup.start", data);
  }

  override onSetupEnd(args: {
    setupId: string;
    attempt: number;
    forScenarioId: string;
    ok: boolean;
    durationMs: number;
    error?: unknown;
    reused: boolean;
  }): void {
    super.onSetupEnd(args);
    const steps = this.setupSteps.get(args.setupId) ?? [];
    const artifacts = this.setupArtifacts.get(args.setupId) ?? [];
    this.setupSteps.delete(args.setupId);
    this.setupArtifacts.delete(args.setupId);
    const data: SetupEndData = {
      setupId: args.setupId,
      name: this.setupNames.get(args.setupId) ?? args.setupId,
      attempt: args.attempt,
      forScenarioId: args.forScenarioId,
      ok: args.ok,
      reused: args.reused,
      durationMs: args.durationMs,
      ...(args.error !== undefined ? { error: formatError(args.error) } : {}),
      // A reused setup ran no steps in this run, so it sends none.
      steps: args.reused ? [] : steps,
      artifacts: !args.reused && !args.ok ? artifacts : [],
    };
    this.emit("setup.end", data);
  }

  override onTeardownEnd(args: { setupId: string; ok: boolean; durationMs: number; error?: unknown }): void {
    super.onTeardownEnd(args);
    // Teardown steps and attachments share the `setup:<id>` owner id; teardown.end carries none, so discard them
    // rather than let them reach the next setup.end of this setup.
    this.setupSteps.delete(args.setupId);
    this.setupArtifacts.delete(args.setupId);
    const data: TeardownEndData = {
      setupId: args.setupId,
      ok: args.ok,
      durationMs: args.durationMs,
      ...(args.error !== undefined ? { error: formatError(args.error) } : {}),
    };
    this.emit("teardown.end", data);
  }

  override onScenarioSkipped(scenario: ScenarioSpec, info: ScenarioSkipInfo): void {
    super.onScenarioSkipped(scenario, info);
    this.skipped += 1;
    this.scenarioIndex += 1;
    const data: ScenarioEndData = {
      scenarioId: scenario.id,
      name: scenario.name,
      ok: false,
      status: "skipped",
      skip: { reason: info.reason, dependency: info.dependency },
      durationMs: 0,
      error: `Skipped: dependency "${info.dependency}" did not pass`,
      steps: [],
      artifacts: [],
    };
    this.emit("scenario.end", data);
  }

  /**
   * Attach a run-level binary artifact (e.g. the whole-run video). Uploaded to shared storage
   * via the sink (never inline for a video) and referenced by storageKey/url on run.end. Must
   * be called before {@link flushPending} so the upload is queued ahead of the run.end delivery.
   */
  attachRunArtifact(args: { name: string; contentType: string; data: Buffer | string }): void {
    const kind = classifyAttachment(args.name, args.contentType);
    const binary = Buffer.isBuffer(args.data) && isBinaryContentType(args.contentType);

    if (binary && this.artifactSink) {
      const buf = args.data as Buffer;
      const artifact: ArtifactRef = {
        kind,
        name: args.name,
        contentType: args.contentType,
        transport: "storage",
        sizeBytes: buf.byteLength,
      };
      this.runArtifacts.push(artifact);
      const runId = this.externalRunId ?? this.runId;
      this.chain = this.chain
        .then(async () => {
          const ref = await this.artifactSink!.put({
            runId,
            scenarioId: "run",
            name: args.name,
            contentType: args.contentType,
            data: buf,
          });
          artifact.storageKey = ref.storageKey;
          artifact.url = ref.url;
        })
        .catch(() => {
          /* upload failed — leave the ref without a key; ingest skips empty refs */
        });
      return;
    }

    // No sink: fall back to inline (a large video base64 that exceeds the cap is dropped).
    if (binary) {
      const bytes = args.data as Buffer;
      const base64 = bytes.toString("base64");
      const artifact: ArtifactRef = {
        kind,
        name: args.name,
        contentType: args.contentType,
        transport: "inline",
        sizeBytes: bytes.byteLength,
      };
      if (base64.length <= INLINE_TEXT_CAP) artifact.inlineData = base64;
      this.runArtifacts.push(artifact);
      return;
    }

    const text = Buffer.isBuffer(args.data) ? args.data.toString("utf8") : String(args.data ?? "");
    this.runArtifacts.push({
      kind,
      name: args.name,
      contentType: args.contentType,
      transport: "inline",
      inlineData: text.length > INLINE_TEXT_CAP ? text.slice(0, INLINE_TEXT_CAP) : text,
      sizeBytes: Buffer.byteLength(text),
    });
  }

  /**
   * Emit run.end and wait for all queued deliveries to complete. `error` names a
   * run-level failure reason (e.g. an unreadable scenario file) so a run that failed
   * before any scenario ran carries a clear message rather than a bare count.
   */
  override onRunEnd(args: RunEndArgs): void {
    super.onRunEnd(args);
    this.runnerOk = args.ok;
  }

  async flushPending(exitCode?: number, error?: string): Promise<void> {
    this.emit("run.end", {
      // A non-zero exitCode (e.g. the runner threw before any scenario ran) must
      // mark the run failed even when failed === 0. A blocked scenario, or a runner that
      // said the run failed, also makes it not ok.
      ok:
        this.failed === 0 &&
        this.blocked === 0 &&
        this.runnerOk !== false &&
        (exitCode === undefined || exitCode === 0),
      total: this.total || this.passed + this.failed + this.skipped,
      passed: this.passed,
      failed: this.failed,
      ...(this.skipped ? { skipped: this.skipped } : {}),
      ...(this.blocked ? { blocked: this.blocked } : {}),
      durationMs: Date.now() - this.startedAtMs,
      exitCode,
      error,
      artifacts: this.runArtifacts.length ? [...this.runArtifacts] : undefined,
    });
    await this.chain;
  }

  /** Where an attachment goes: the setup buffer for a `setup:<id>` scenario id, else the current scenario. */
  private artifactBucketFor(scenarioId: string): ArtifactRef[] {
    const setupId = setupIdOf(scenarioId);
    if (setupId === undefined) return this.currentArtifacts;
    const bucket = this.setupArtifacts.get(setupId) ?? [];
    this.setupArtifacts.set(setupId, bucket);
    return bucket;
  }

  private emit<T>(event: LifecycleEventType, data: T): void {
    const envelope: LifecycleEnvelope<T> = {
      event,
      externalRunId: this.externalRunId,
      runId: this.runId,
      runName: this.runName,
      seq: this.seq++,
      emittedAt: new Date().toISOString(),
      data,
    };
    this.chain = this.chain.then(() => this.deliver(envelope)).catch(() => {});
  }

  private async deliver(envelope: LifecycleEnvelope): Promise<void> {
    try {
      const res = await this.post(this.webhookUrl, envelope, {
        headers: this.headers,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      if (!res.ok) {
        console.warn(
          `[LifecycleWebhookReporter] ${envelope.event} → HTTP ${res.status}`,
        );
      }
    } catch (err) {
      console.warn(
        `[LifecycleWebhookReporter] failed to deliver ${envelope.event}: ${err}`,
      );
    }
  }
}
