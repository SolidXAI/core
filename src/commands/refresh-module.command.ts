import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ModuleMetadataService } from '../services/module-metadata.service';
import { CommandError } from './helper';

interface CommandOptions {
  id: number;
  name: string;
  dryRun: boolean;
}

@Command({
  name: 'refresh-module',
  description: 'Refreshes a module and its model and fields i.e (entity,dto,service,controller files)',
})
export class RefreshModuleCommand extends CommandRunner {
  constructor(
    private readonly moduleMetadataService: ModuleMetadataService,
  ) {
    super();
  }
  private readonly logger = new Logger(RefreshModuleCommand.name);

  async run(_passedParam: string[], options?: CommandOptions): Promise<void> {
    const errors = this.validate(options);
    if (errors.length) {
      errors.forEach((error) => this.logger.error(error));
      return;
    }
    const codeGenerationOptions = {
      moduleId: options.id,
      moduleUserKey: options.name,
      dryRun: options.dryRun,
    };
    await this.moduleMetadataService.generateCode(codeGenerationOptions);
  }


  @Option({
    flags: '-i, --id [module ID]',
    description: 'Module ID from the ss_module_metadata table',
  })
  parseId(val: string): number {
    return +val;
  }

  // Accept the module name as an argument
  @Option({
    flags: '-n, --name [module name]',
    description: 'Module Name from the ss_module_metadata table',
  })
  parseName(val: string): string {
    return val;
  }

  @Option({
    flags: '-d, --dryRun [dry run]',
    description: 'Dry run the command',
  })
  parseDryRun(val: string): boolean {
    this.logger.debug(`Dry run : ${val}`);
    return (val === 'false') ? false : true;
  }


  // Validate the options passed
  validate(options: CommandOptions): CommandError[] {
    if (!options.id && !options.name) {
      return [new CommandError('Module ID or Module Name is required')];
    }
    return [];
  }

}
