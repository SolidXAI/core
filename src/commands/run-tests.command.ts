import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { ConsoleReporter } from 'src/testing/reporter/console-reporter';
import { runFromMetadata } from 'src/testing/runner/run-from-metadata';
import type { TestingMetadata } from 'src/testing/contracts/testing-metadata.types';

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
