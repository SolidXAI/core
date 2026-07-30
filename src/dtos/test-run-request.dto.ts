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
 * Body of `POST /test-runs`. Carries the FULL test definition inline (scenarios +
 * optional data/roles/users — the `testing` block minus `specs`), so the runner is
 * location-agnostic and never reads a fixed module/path. `specs` (custom step code)
 * cannot travel inline and must be deployed on the worker.
 */
export class TestRunRequestDto {
  @IsOptional()
  @IsArray()
  scenarios?: ScenarioSpec[];

  @IsOptional()
  @IsString()
  scenariosPath?: string;

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
  @IsBoolean()
  recordVideo?: boolean;

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
