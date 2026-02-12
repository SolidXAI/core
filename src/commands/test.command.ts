import { Command, CommandRunner } from 'nest-commander';
import { TestDataCommand } from './test-data.command';
import { TestRunCommand } from './run-tests.command';

@Command({
  name: 'test',
  description: 'Testing utilities.',
  subCommands: [TestRunCommand, TestDataCommand],
})
export class TestCommand extends CommandRunner {
  async run(): Promise<void> {
    console.log('Usage: solidctl test <run|data> [options]');
  }
}
