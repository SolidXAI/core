import { randomUUID } from "crypto";

import { ConsoleReporter } from "./console-reporter";
import type { IArtifactSink } from "./artifact-sink";
import type {
  ArtifactRef,
  LifecycleEnvelope,
  LifecycleEventType,
  ScenarioEndData,
  StepResultData,
} from "./lifecycle-events.types";
import type { OpStep, ScenarioSpec } from "../contracts/testing-metadata.types";
import type { StepPhase } from "../contracts/runtime-context.types";

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

/** Map an `attach()` payload to an ArtifactRef. Covers API/console/network + video/screenshots. */
function classifyAttachment(name: string, contentType: string): ArtifactRef["kind"] {
  const hint = `${name} ${contentType}`.toLowerCase();
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
  private currentSteps: StepResultData[] = [];
  private currentArtifacts: ArtifactRef[] = [];
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

  onRunStart(args: {
    total: number;
    startedAt: string;
    scenarioIds: string[];
  }): void {
    this.total = args.total;
    this.startedAtMs = Date.now();
    this.emit("run.start", {
      total: args.total,
      scenarioIds: args.scenarioIds,
      startedAt: args.startedAt,
    });
  }

  override onScenarioStart(scenario: ScenarioSpec): void {
    super.onScenarioStart(scenario);
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
  }

  override onStepEnd(args: {
    scenarioId: string;
    phase: StepPhase;
    step: OpStep;
    ok: boolean;
    error?: unknown;
    durationMs: number;
  }): void {
    super.onStepEnd(args);
    this.currentSteps.push({
      phase: String(args.phase),
      operation: args.step.op,
      name: args.step.name,
      ok: args.ok,
      durationMs: args.durationMs,
      error: args.error ? formatError(args.error) : undefined,
    });
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
      this.currentArtifacts.push(artifact);
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
      this.currentArtifacts.push(artifact);
      return;
    }

    const text = Buffer.isBuffer(args.data)
      ? args.data.toString("utf8")
      : String(args.data ?? "");
    this.currentArtifacts.push({
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
    result: { ok: boolean; error?: unknown; durationMs: number },
  ): void {
    super.onScenarioEnd(scenario, result);
    if (result.ok) {
      this.passed += 1;
    } else {
      this.failed += 1;
    }
    const data: ScenarioEndData = {
      scenarioId: scenario.id,
      name: scenario.name,
      ok: result.ok,
      durationMs: result.durationMs,
      error: result.error ? formatError(result.error) : undefined,
      steps: [...this.currentSteps],
      artifacts: [...this.currentArtifacts],
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
  async flushPending(exitCode?: number, error?: string): Promise<void> {
    this.emit("run.end", {
      // A non-zero exitCode (e.g. the runner threw before any scenario ran) must
      // mark the run failed even when failed === 0.
      ok: this.failed === 0 && (exitCode === undefined || exitCode === 0),
      total: this.total || this.passed + this.failed,
      passed: this.passed,
      failed: this.failed,
      durationMs: Date.now() - this.startedAtMs,
      exitCode,
      error,
      artifacts: this.runArtifacts.length ? [...this.runArtifacts] : undefined,
    });
    await this.chain;
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
