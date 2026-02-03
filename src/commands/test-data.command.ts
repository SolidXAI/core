import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ModuleTestDataService } from 'src/seeders/module-test-data.service';

interface TestDataCommandOptions {
  loadData?: boolean;
  modulesToTest?: string;
  createDatasources?: boolean;
  deleteDatasources?: boolean;
}

@Command({
  name: 'test-data',
  description: 'Seed test data from testData sections',
})
export class TestDataCommand extends CommandRunner {
  private readonly logger = new Logger(TestDataCommand.name);

  constructor(private readonly testDataService: ModuleTestDataService) {
    super();
  }

  async run(_passedParam: string[], options?: TestDataCommandOptions): Promise<void> {
    try {
      const loadData = Boolean(options?.loadData);
      const createDatasources = Boolean(options?.createDatasources);
      const deleteDatasources = Boolean(options?.deleteDatasources);

      const selectedModes = [loadData, createDatasources, deleteDatasources].filter(Boolean).length;
      if (selectedModes > 1) {
        this.logger.error('Please specify only one of --load-data, --create-datasources, or --delete-datasources.');
        console.log('Please specify only one of --load-data, --create-datasources, or --delete-datasources.');
        return;
      }

      if (!loadData && !createDatasources && !deleteDatasources) {
        this.logger.error('Please specify one of --load-data, --create-datasources, or --delete-datasources.');
        console.log('Please specify one of --load-data, --create-datasources, or --delete-datasources.');
        return;
      }

      if (deleteDatasources) {
        this.logger.log('Deleting test datasource environment and databases.');
        console.log('Deleting test datasource environment and databases.');
        await this.testDataService.deleteTestDatasources();
        return;
      }

      if (createDatasources) {
        this.logger.log('Creating test datasource environment file and manifest.');
        console.log('Creating test datasource environment file and manifest.');
        await this.testDataService.createTestDatasources();
        return;
      }

      if (loadData) {
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
    flags: '--load-data',
    description: 'Seed test data from testData sections',
  })
  parseLoadData(): boolean {
    return true;
  }

  @Option({
    flags: '--create-datasources',
    description: 'Create a new .env.<dbRunName> and test datasource manifest',
  })
  parseCreateDatasources(): boolean {
    return true;
  }

  @Option({
    flags: '--delete-datasources',
    description: 'Delete test datasource env/manifest and drop test databases',
  })
  parseDeleteDatasources(): boolean {
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
