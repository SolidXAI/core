import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { SolidRegistry } from 'src/helpers/solid-registry';

interface SeedCommandOptions {
  seeder?: string;
  modulesToSeed?: string;
  testDataSetup?: boolean;
  testDataTeardown?: boolean;
  prune?: boolean;
}

@Command({ name: 'seed', description: 'Install seed data for a given module' })
export class SeedCommand extends CommandRunner {
  private readonly logger = new Logger(SeedCommand.name);

  constructor(private readonly solidRegistry: SolidRegistry) {
    super();
  }

  async run(passedParam: string[], options?: SeedCommandOptions): Promise<void> {
    let parsedConf: any = null;
    if (options?.modulesToSeed) {
      const modulesToSeed = options.modulesToSeed
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
      parsedConf = { modulesToSeed };
      this.logger.log(`Modules to seed: ${modulesToSeed.join(', ')}`);
    } else {
      this.logger.log('No --modules-to-seed flag provided. Running with default seeder behavior.');
    }

    if (options?.testDataSetup || options?.testDataTeardown) {
      parsedConf = parsedConf ?? {};
      if (options.testDataSetup) parsedConf.testDataSetup = true;
      if (options.testDataTeardown) parsedConf.testDataTeardown = true;
    }
    if (options?.prune) {
      parsedConf = parsedConf ?? {};
      parsedConf.pruneMetadata = true;
    }

    const seeder = this.solidRegistry
      .getSeeders()
      .filter((seeder) => seeder.name === options.seeder)
      .map((seeder) => seeder.instance)
      .pop();
    if (!seeder) {
      this.logger.error(`Seeder service ${options.seeder} not found. Does your service have a seed() method?`);
      return;
    }
    this.logger.log(`Running the seed() method for seeder: ${seeder.constructor.name}`);
    await seeder.seed(parsedConf);
  }

  /**
   * This parameter will be useful, to support seeders with the same name in different modules
   * Currently the seeder service won't support seeder with same classname within a module
   **/
  @Option({ flags: '-m, --modules-to-seed [module names]', description: 'Comma-separated list of module names to seed.', required: false })
  parseModulesToSeed(val: string): string {
    return val;
  }

  @Option({ flags: '-s, --seeder [seeder name]', description: 'The seeder to run.', required: true, defaultValue: 'ModuleMetadataSeederService' })
  parseString(val: string): string {
    return val;
  }

  @Option({ flags: '--test-data-setup', description: 'Seed test data from testData sections.' })
  parseTestSetup(): boolean {
    return true;
  }

  @Option({ flags: '--test-data-teardown', description: 'Delete test data defined in testData sections.' })
  parseTestTeardown(): boolean {
    return true;
  }

  @Option({ flags: '--prune', description: 'Prune metadata not present in JSON.' })
  parsePrune(): boolean {
    return true;
  }
}
