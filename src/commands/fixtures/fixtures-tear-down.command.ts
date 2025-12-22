import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { SolidIntrospectService } from 'src/services/solid-introspect.service';

interface CommandOptions {
  scenario: string;
  module: string;
}

@Command({
  name: 'fixtures tear-down',
  description: 'Handles setup and tear down of fixtures for the SolidX application',
})
export class FixturesTearDownCommand extends CommandRunner {
  constructor(
    private readonly introspectService: SolidIntrospectService,
  ) {
    super();
  }
  private readonly logger = new Logger(this.constructor.name);

  async run(_passedParam: string[], options?: CommandOptions): Promise<void> {
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
    flags: '-m, --module [module name]',
    description: 'Module Name from the ss_model_metadata table',
    required: true,
  })
  parseModule(val: string): string {
    return val;
  }

}
