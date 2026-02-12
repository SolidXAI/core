import { Logger } from '@nestjs/common';
import { SubCommand, CommandRunner, Option } from 'nest-commander';
import { ModuleTestDataService } from 'src/seeders/module-test-data.service';

interface TestDataCommandOptions {
  load?: boolean;
  modulesToTest?: string;
  setup?: boolean;
  teardown?: boolean;
}

@SubCommand({
  name: 'data',
  description: 'Seed test data from testing.data sections',
})
export class TestDataCommand extends CommandRunner {
  private readonly logger = new Logger(TestDataCommand.name);

  constructor(private readonly testDataService: ModuleTestDataService) {
    super();
  }

  async run(_passedParam: string[], options?: TestDataCommandOptions): Promise<void> {
    try {
      const load = Boolean(options?.load);
      const setup = Boolean(options?.setup);
      const teardown = Boolean(options?.teardown);

      const selectedModes = [load, setup, teardown].filter(Boolean).length;
      if (selectedModes > 1) {
        this.logger.error('Please specify only one of --load, --setup, or --teardown.');
        console.log('Please specify only one of --load, --setup, or --teardown.');
        return;
      }

      if (!load && !setup && !teardown) {
        this.logger.error('Please specify one of --load, --setup, or --teardown.');
        console.log('Please specify one of --load, --setup, or --teardown.');
        return;
      }

      if (teardown) {
        this.logger.log('Deleting test datasource environment and databases.');
        console.log('Deleting test datasource environment and databases.');
        await this.testDataService.deleteTestDatasources();
        return;
      }

      if (setup) {
        this.logger.log('Creating test datasource environment file and manifest.');
        console.log('Creating test datasource environment file and manifest.');
        await this.testDataService.createTestDatasources();
        return;
      }

      if (load) {
        const modulesToTest = options?.modulesToTest ? options.modulesToTest.split(',').map((m) => m.trim()).filter(Boolean) : null;
        if (modulesToTest?.length) {
          this.logger.log(`Test data setup for modules: ${modulesToTest.join(', ')}`);
          console.log(`Test data setup for modules: ${modulesToTest.join(', ')}`);
        } else {
          this.logger.log('Test data setup for all modules.');
          console.log('Test data setup for all modules.');
        }
        await this.testDataService.setupTestData(modulesToTest ?? undefined);
        return;
      }
    } catch (err: any) {
      const message = err?.message ?? String(err);
      this.logger.error(message);
      console.error(`Test data command failed: ${message}`);
      if (err?.stack) {
        console.error(err.stack);
      }
      throw err;
    }
  }

  @Option({
    flags: '--load',
    description: 'Seed test data from testing.data sections',
  })
  parseLoad(): boolean {
    return true;
  }

  @Option({
    flags: '--setup',
    description: 'Create a new .env.<dbRunName> and test datasource manifest',
  })
  parseSetup(): boolean {
    return true;
  }

  @Option({
    flags: '--teardown',
    description: 'Delete test datasource env/manifest and drop test databases',
  })
  parseTeardown(): boolean {
    return true;
  }

  @Option({
    flags: '--modules-to-test [module names]',
    description: 'Comma-separated list of module names to test (defaults to all modules).',
    required: false,
  })
  parseModulesToTest(val: string): string {
    return val;
  }

}
