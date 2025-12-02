import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { SolidRegistry } from 'src/helpers/solid-registry';

interface SeedCommandOptions {
  conf?: string;
  seeder?: string;
}

@Command({ name: 'seed', description: 'Install seed data for a given module' })
export class SeedCommand extends CommandRunner {
  private readonly logger = new Logger(SeedCommand.name);

  constructor(private readonly solidRegistry: SolidRegistry) {
    super();
  }

  async run(passedParam: string[], options?: SeedCommandOptions): Promise<void> {
    // TODO: check if options.conf is non empty and a valid json string.
    // TODO: convert to json object JSON.parse

    const seeder = this.solidRegistry
      .getSeeders()
      .filter((seeder) => seeder.name === options.seeder)
      .map((seeder) => seeder.instance)
      .pop();
    if (!seeder) {
      this.logger.error(`Seeder service ${options.seeder} not found. Does your service have a seed() method?`);
      return;
    }
    this.logger.log(`Running the seed() method for seeder :${seeder.constructor.name}`);
    await seeder.seed();
  }

  @Option({
    flags: '-c, --conf [configuration json]',
    description: 'A configuration json, pass a valid json string.',
    required: true
  })
  /**
   * TODO
   * This parameter will be useful, to support seeders with the same name in different modules
   * Currently the seeder service won't support seeder with same classname within a module
   **/
  parseConf(val: string): string {
    return val;
  }

  @Option({
    flags: '-s, --seeder [seeder name]',
    description: 'The seeder to run.',
    required: true,
    defaultValue: 'ModuleMetadataSeederService'
  })
  parseString(val: string): string {
    return val;
  }
}
