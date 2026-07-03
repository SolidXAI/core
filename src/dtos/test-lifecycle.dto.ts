import { IsArray, IsOptional, IsString } from 'class-validator';

/** A single preparation step the prepare-hook can run, in order. */
export type PrepareStep = 'reset' | 'seed' | 'load';

/**
 * Body of `POST /test-lifecycle/prepare`. Honors the testingHub "prepare contract":
 * an orchestrator asks this app to bring its OWN test DB to a clean, seeded state.
 */
export class PrepareRequestDto {
  /** Ordered steps. Defaults to ["reset","seed","load"] when omitted/empty. */
  @IsOptional()
  @IsArray()
  steps?: PrepareStep[];

  /** Restrict seed/load to specific modules (defaults to all). */
  @IsOptional()
  @IsArray()
  modules?: string[];

  /** Correlation id supplied by the caller (e.g. testingHub TestRun id). */
  @IsOptional()
  @IsString()
  externalRunId?: string;
}

export interface PrepareStepResult {
  name: string;
  ok: boolean;
  ms: number;
  error?: string;
}

/** Synchronous response: ok=true means the test DB is clean + seeded + ready. */
export interface PrepareResponse {
  ok: boolean;
  steps: PrepareStepResult[];
  durationMs: number;
}
