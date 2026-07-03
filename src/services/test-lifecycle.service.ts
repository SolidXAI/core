import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SolidRegistry } from 'src/helpers/solid-registry';
import { ModuleMetadataSeederService } from 'src/seeders/module-metadata-seeder.service';
import { ModuleTestDataService } from 'src/seeders/module-test-data.service';
import {
  PrepareRequestDto,
  PrepareResponse,
  PrepareStep,
  PrepareStepResult,
} from 'src/dtos/test-lifecycle.dto';

const DEFAULT_STEPS: PrepareStep[] = ['reset', 'seed', 'load'];

/**
 * Brings THIS app's test database to a clean, seeded state in-process — the same end
 * result as running `solidctl test data --teardown/--setup`, `seed`, `test data --load`
 * by hand, but without rewriting `.env` or restarting:
 *   - reset → drop + recreate all tables on every registered DataSource (synchronize)
 *   - seed  → ModuleMetadataSeederService.seed() (models/views/roles/users/menus/perms)
 *   - load  → ModuleTestDataService.setupTestData() (testing.data fixtures + media)
 * Reuses the exact services the CLI commands use. Access is gated by the controller
 * (assertTestLifecycleAllowed) so this never runs against production.
 */
@Injectable()
export class TestLifecycleService {
  private readonly logger = new Logger(TestLifecycleService.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly solidRegistry: SolidRegistry,
    private readonly seeder: ModuleMetadataSeederService,
    private readonly testDataService: ModuleTestDataService,
  ) {}

  /** Run the requested steps in order; stop on the first failure (later steps depend on earlier). */
  async prepare(dto: PrepareRequestDto): Promise<PrepareResponse> {
    const steps = dto.steps && dto.steps.length ? dto.steps : DEFAULT_STEPS;
    const modules = dto.modules && dto.modules.length ? dto.modules : undefined;
    const results: PrepareStepResult[] = [];
    const startedAt = Date.now();

    for (const step of steps) {
      const stepStart = Date.now();
      try {
        await this.runStep(step, modules);
        results.push({ name: step, ok: true, ms: Date.now() - stepStart });
      } catch (err: any) {
        const message = err?.message ?? String(err);
        this.logger.error(`prepare step "${step}" failed: ${message}`);
        results.push({ name: step, ok: false, ms: Date.now() - stepStart, error: message });
        break;
      }
    }

    const ok = results.length === steps.length && results.every((r) => r.ok);
    return { ok, steps: results, durationMs: Date.now() - startedAt };
  }

  private async runStep(step: PrepareStep, modules?: string[]): Promise<void> {
    switch (step) {
      case 'reset':
        return this.reset();
      case 'seed':
        return this.seed(modules);
      case 'load':
        return this.load(modules);
      default:
        throw new Error(`Unknown prepare step: "${step}"`);
    }
  }

  /** Drop + recreate all tables on every registered DataSource — a clean schema, no data. */
  async reset(): Promise<void> {
    const names = this.solidRegistry
      .getSolidDatabaseModules()
      .map((wrapper) => wrapper.instance?.name?.())
      .filter(Boolean)
      .map((name: string) => name.toLowerCase());

    if (!names.length) {
      throw new Error('No solid database modules registered; cannot reset.');
    }

    for (const name of names) {
      const dataSource = this.resolveDataSource(name);
      this.logger.log(`reset: synchronize(dropBeforeSync) on datasource "${name}"`);
      await dataSource.synchronize(true);
    }
  }

  /** Seed module metadata (models/views/roles/users/menus/permissions) for the given modules. */
  async seed(modules?: string[]): Promise<void> {
    const conf = modules?.length ? { modulesToSeed: modules } : undefined;
    await this.seeder.seed(conf);
  }

  /** Load test fixtures (testing.data/roles/users + media) for the given modules. */
  async load(modules?: string[]): Promise<void> {
    await this.testDataService.setupTestData(modules);
  }

  private resolveDataSource(name: string): DataSource {
    // getDataSourceToken('default') resolves to the default DataSource token; any other
    // name resolves to `${name}DataSource`. Mirrors ModuleTestDataService.
    const token = name ? getDataSourceToken(name) : getDataSourceToken();
    const dataSource = this.moduleRef.get<DataSource>(token, { strict: false });
    if (!dataSource) {
      throw new Error(`No DataSource found for "${name}"`);
    }
    return dataSource;
  }
}
