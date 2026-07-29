import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ModuleMetadataSeederOptions } from 'src/interfaces';

interface SeedCommandOptions {
  seeder?: string;
  modulesToSeed?: string;
  prune?: boolean;
  skipHooks?: boolean;
}

@Command({ name: 'seed', description: 'Install seed data for a given module' })
export class SeedCommand extends CommandRunner {
  private readonly logger = new Logger(SeedCommand.name);

  constructor(private readonly solidRegistry: SolidRegistry) {
    super();
  }

  async run(passedParam: string[], options?: SeedCommandOptions): Promise<void> {
    let parsedConf: ModuleMetadataSeederOptions | null = null;
    if (options?.modulesToSeed) {
      const modulesToSeed = options.modulesToSeed
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
      parsedConf = {
        modulesToSeed,
        pruneMetadata: false,
        seedGlobalMetadata: true,
        skipHooks: false,
      };
      this.logger.log(`Modules to seed: ${modulesToSeed.join(', ')}`);
    } else {
      this.logger.log('No --modules-to-seed flag provided. Running with default seeder behavior.');
    }

    if (options?.prune) {
      parsedConf = parsedConf ?? {
        modulesToSeed: null,
        pruneMetadata: false,
        seedGlobalMetadata: true,
        skipHooks: false,
      };
      parsedConf.pruneMetadata = true;
    }

    if (options?.skipHooks) {
      parsedConf = parsedConf ?? {
        modulesToSeed: null,
        pruneMetadata: false,
        seedGlobalMetadata: true,
        skipHooks: false,
      };
      parsedConf.skipHooks = true;
      this.logger.log('Skipping pre-seed and post-seed hooks.');
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

  @Option({ flags: '--prune', description: 'Prune metadata not present in JSON.' })
  parsePrune(): boolean {
    return true;
  }

  @Option({ flags: '--skip-hooks', description: 'Skip emitting pre-seed and post-seed lifecycle hooks/events.' })
  parseSkipHooks(): boolean {
    return true;
  }
}
