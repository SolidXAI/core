import { Command, CommandRunner, Option } from 'nest-commander';
import { FixturesHelperService } from 'src/services/fixtures-helper.service';

interface CommandOptions {
  scenario: string;
  module: string;
}

@Command({
  name: 'fixtures setup',
  description: 'Handles setup and tear down of fixtures for the SolidX application',
})
export class FixturesSetupCommand extends CommandRunner {
  constructor(
    private readonly fixturesService: FixturesHelperService,
  ) {
    super();
  }

  async run(_passedParam: string[], options?: CommandOptions): Promise<void> {
    await this.fixturesService.setupFixtures(options.module, options.scenario);
  }

  // Accept the task name i.e setup/tear-down for the fixtures command
  @Option({
    flags: '-s, --scenario [scenario name]',
    description: 'Setup scenario name for the fixtures command',
    required: true,
  })
  parseScenario(val: string): string {
    return val;
  }

  // Accept the module name as an argument
  @Option({
    flags: '-m, --module-name [module name]',
    description: 'Module Name from the ss_model_metadata table',
    required: true,
  })
  parseModule(val: string): string {
    return val;
  }

}
