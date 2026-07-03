import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

import type {
  ScenarioSpec,
  ScenarioType,
  TestingDataRecord,
  TestingRoleSpec,
  TestingUserSpec,
} from '../testing/contracts/testing-metadata.types';

/**
 * Per-scenario capture toggles. Structurally compatible with the typed
 * `CaptureOptions` introduced in Phase 2 (A3, in adapters/ui/ui.types.ts).
 */
export interface CaptureOptionsInput {
  console?: boolean;
  network?: boolean;
  screenshotOnFailure?: boolean;
  screenshotAtEnd?: boolean;
  video?: boolean;
  har?: boolean;
}

/**
 * Pre-run test-environment preparation. The worker POSTs `hookUrl` (the prepare-hook —
 * Solid's built-in `/test-lifecycle/prepare` or a client's own endpoint) before any
 * scenario, with `{ steps, modules, externalRunId }` and an optional secret header.
 */
export interface PrepareConfig {
  /** URL to POST before the run. When absent, no prepare step runs. */
  hookUrl: string;
  /** Shared secret sent as `X-Test-Prepare-Secret` (matches the client's SOLID_TEST_LIFECYCLE_SECRET). */
  secret?: string;
  /** Steps to run, in order. Default on the hook side: ["reset","seed","load"]. */
  steps?: string[];
  /** Restrict seed/load to specific modules (default: all). */
  modules?: string[];
  /** Max time to wait for prep before failing the run (ms). Default 120000. */
  timeoutMs?: number;
}

/**
 * Body of `POST /test-runs`. Carries the FULL test definition inline (scenarios +
 * optional data/roles/users — the `testing` block minus `specs`), so the runner is
 * location-agnostic and never reads a fixed module/path. `specs` (custom step code)
 * cannot travel inline and must be deployed on the worker.
 */
export class TestRunRequestDto {
  @IsArray()
  scenarios!: ScenarioSpec[];

  @IsOptional()
  @IsArray()
  data?: TestingDataRecord[];

  @IsOptional()
  @IsArray()
  roles?: TestingRoleSpec[];

  @IsOptional()
  @IsArray()
  users?: TestingUserSpec[];

  /** API base URL for relative request URLs. */
  @IsOptional()
  @IsString()
  baseUrl?: string;

  /** UI base URL for relative navigation (Playwright). */
  @IsOptional()
  @IsString()
  uiBaseUrl?: string;

  @IsOptional()
  @IsString()
  type?: ScenarioType;

  @IsOptional()
  @IsString()
  env?: string;

  @IsOptional()
  @IsBoolean()
  headless?: boolean;

  @IsOptional()
  @IsArray()
  includeTags?: string[];

  @IsOptional()
  @IsArray()
  scenarioIds?: string[];

  @IsOptional()
  @IsArray()
  skipScenarioIds?: string[];

  /** Where lifecycle events are POSTed (e.g. testingHub ingest endpoint). */
  @IsString()
  webhookUrl!: string;

  /** Correlation id supplied by the caller (e.g. testingHub TestRun id). */
  @IsOptional()
  @IsString()
  externalRunId?: string;

  /**
   * Per-run env variables for `${env:X}` interpolation — e.g. { BASE_URL: app.url }
   * so scenarios target the application under test rather than the runner itself.
   * (Distinct from `env` above, which is the dev/uat/prod environment label.)
   */
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  /**
   * Optional pre-run preparation. When `prepare.hookUrl` is set, the worker POSTs it
   * BEFORE any scenario to reset + seed + load the app's test DB, and fails the run if
   * prep fails. Omit for apps that self-seed via setup scenarios (2B) or need no prep.
   */
  @IsOptional()
  @IsObject()
  prepare?: PrepareConfig;

  @IsOptional()
  @IsObject()
  capture?: CaptureOptionsInput;

  @IsOptional()
  @IsBoolean()
  printApiLogs?: boolean;

  /** Queue broker override: database | redis | rabbitmq (default: database). */
  @IsOptional()
  @IsString()
  broker?: string;
}

/** Queue payload = the request plus the runner-generated run id. */
export interface TestRunJobPayload extends TestRunRequestDto {
  runId: string;
}
