import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ModuleMetadataService } from '../services/module-metadata.service';
import { CommandError } from './helper';

interface CommandOptions {
  moduleId: number;
  moduleName: string;
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
      moduleId: options.moduleId,
      moduleUserKey: options.moduleName,
      dryRun: options.dryRun,
    };
    await this.moduleMetadataService.generateCode(codeGenerationOptions);
  }


  @Option({
    flags: '-id, --moduleId [module ID]',
    description: 'Module ID from the ss_module_metadata table',
  })
  parseModuleId(val: string): number {
    return +val;
  }

    // Accept the module name as an argument
    @Option({
      flags: '-n, --moduleName [module name]',
      description: 'Module Name from the ss_module_metadata table',
    })
    parseModuleName(val: string): string {
      return val;
    }
    
    @Option({
      flags: '-d, --dryRun [dry run]',
      description: 'Dry run the command',
    })
    parseDryRun(val: string): boolean {
      this.logger.debug(`Dry run : ${val}`);
      return (val === 'false')? false : true;
    }
  

    // Validate the options passed
    validate(options: CommandOptions): CommandError[] {
      if (!options.moduleId && !options.moduleName) {
        return [new CommandError('Module ID or Module Name is required')];
      }
      return [];
    }
  
}
