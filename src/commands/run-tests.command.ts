import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import * as path from 'path';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { ConsoleReporter } from 'src/testing/reporter/console-reporter';
import { runFromMetadata } from 'src/testing/runner/run-from-metadata';
import type { TestingMetadata } from 'src/testing/contracts/testing-metadata.types';
import { SpecRegistry } from 'src/testing/core/spec-registry';

interface RunTestsCommandOptions {
  module?: string;
  moduleName?: string;
  scenarioIds?: string;
  includeTags?: string;
  reporter?: string;
  apiBaseUrl?: string;
  uiBaseUrl?: string;
  headless?: boolean;
  timeoutMs?: number;
  retries?: number;
  listSpecs?: boolean;
}

@Command({
  name: 'run-tests',
  description: 'Run testing scenarios from module metadata.',
})
export class RunTestsCommand extends CommandRunner {
  private readonly logger = new Logger(RunTestsCommand.name);

  constructor(
    private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
  ) {
    super();
  }

  async run(passedParam: string[], options?: RunTestsCommandOptions): Promise<void> {
    try {
      const moduleName = options?.moduleName ?? options?.module ?? passedParam?.[0];
      if (!moduleName) {
        this.logger.error('Module name is required. Use --module or pass it as the first argument.');
        return;
      }

      const metadataPath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
      if (!metadataPath) {
        this.logger.error(`Unable to resolve metadata path for module: ${moduleName}`);
        return;
      }

      const metadata = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(metadataPath);
      if (!metadata?.testing) {
        this.logger.error(`No testing configuration found in metadata: ${metadataPath}`);
        return;
      }

      const listSpecs = options?.listSpecs ?? false;
      const specEntries = Array.isArray(metadata.testing?.specs)
        ? metadata.testing.specs
        : [];

      if (listSpecs) {
        const registry = new SpecRegistry();
        if (specEntries.length) {
          loadSpecRegistrations(specEntries, metadataPath, registry);
        }
        printSpecList(registry.list());
        return;
      }
      if (!metadata?.testing?.scenarios || !Array.isArray(metadata.testing.scenarios)) {
        this.logger.error(`No testing.scenarios found in metadata: ${metadataPath}`);
        return;
      }

      const scenarioIds = splitCsv(options?.scenarioIds);
      const includeTags = splitCsv(options?.includeTags);

      const reporterName = options?.reporter ?? 'console';
      if (reporterName !== 'console') {
        this.logger.error(`Unsupported reporter: ${reporterName}. Use "console".`);
        return;
      }

      const apiBaseUrl = options?.apiBaseUrl ?? process.env.BASE_URL;
      const uiBaseUrl = options?.uiBaseUrl ?? process.env.FRONTEND_BASE_URL;
      const headless = options?.headless ?? true;

      await runFromMetadata({
        metadata: metadata as TestingMetadata,
        scenarioIds,
        includeTags,
        reporter: new ConsoleReporter(),
        api: apiBaseUrl ? { baseUrl: apiBaseUrl } : undefined,
        ui: { baseUrl: uiBaseUrl, headless },
        defaults: {
          timeoutMs: options?.timeoutMs,
          retries: options?.retries,
        },
        specs: specEntries.length
          ? (registry) => loadSpecRegistrations(specEntries, metadataPath, registry)
          : undefined,
      });
    } catch (err: any) {
      const message = err?.message ?? String(err);
      this.logger.error(message);
      console.error(`Run tests command failed: ${message}`);
      if (err?.stack) {
        console.error(err.stack);
      }
      throw err;
    }
  }

  @Option({
    flags: '-m, --module [module name]',
    description: 'Module name to load metadata from.',
    required: false,
  })
  parseModule(val: string): string {
    return val;
  }

  @Option({
    flags: '--scenario-ids [ids]',
    description: 'Comma-separated list of scenario ids to run.',
    required: false,
  })
  parseScenarioIds(val: string): string {
    return val;
  }

  @Option({
    flags: '--include-tags [tags]',
    description: 'Comma-separated list of tags; scenario must include all.',
    required: false,
  })
  parseIncludeTags(val: string): string {
    return val;
  }

  @Option({
    flags: '--reporter [name]',
    description: 'Reporter name (currently only "console").',
    required: false,
  })
  parseReporter(val: string): string {
    return val;
  }

  @Option({
    flags: '--list-specs [true|false]',
    description: 'List registered test specs and exit.',
    required: false,
  })
  parseListSpecs(val?: string): boolean {
    if (val === undefined) return true;
    return val === 'false' ? false : true;
  }

  @Option({
    flags: '--api-base-url [url]',
    description: 'API base URL (defaults to process.env.BASE_URL).',
    required: false,
  })
  parseApiBaseUrl(val: string): string {
    return val;
  }

  @Option({
    flags: '--ui-base-url [url]',
    description: 'UI base URL (defaults to process.env.FRONTEND_BASE_URL).',
    required: false,
  })
  parseUiBaseUrl(val: string): string {
    return val;
  }

  @Option({
    flags: '--headless [true|false]',
    description: 'Run UI browser in headless mode (default: true).',
    required: false,
  })
  parseHeadless(val: string): boolean {
    return val === 'false' ? false : true;
  }

  @Option({
    flags: '--timeout-ms [number]',
    description: 'Default scenario timeout in milliseconds.',
    required: false,
  })
  parseTimeoutMs(val: string): number {
    return Number(val);
  }

  @Option({
    flags: '--retries [number]',
    description: 'Default scenario retries.',
    required: false,
  })
  parseRetries(val: string): number {
    return Number(val);
  }
}

function splitCsv(value?: string): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function resolveSpecPath(entry: string, metadataPath: string): string {
  if (path.isAbsolute(entry)) {
    return entry;
  }
  if (entry.startsWith('.')) {
    return path.resolve(path.dirname(metadataPath), entry);
  }
  return path.resolve(process.cwd(), entry);
}

function loadSpecRegistrations(entries: string[], metadataPath: string, registry: SpecRegistry): void {
  for (const entry of entries) {
    const resolved = resolveSpecPath(entry, metadataPath);
    let mod: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      mod = require(resolved);
    } catch (err: any) {
      const message = err?.message ?? String(err);
      throw new Error(
        `Failed to load test spec module "${entry}" resolved to "${resolved}": ${message}`,
      );
    }
    const register = mod?.registerTestSpecs ?? mod?.default ?? mod;
    if (typeof register !== 'function') {
      throw new Error(
        `Test spec module "${entry}" did not export a register function (expected "registerTestSpecs" or default export).`,
      );
    }
    register(registry);
  }
}
function printSpecList(specIds: string[]): void {
  if (!specIds.length) {
    console.log('No test specs registered.');
    return;
  }
  console.log('Registered test specs:');
  for (const id of specIds) {
    console.log(`- ${id}`);
  }
}
