import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { CommandError } from './helper';

interface CommandOptions {
  modelName: string;
  modelId: number;
  dryRun: boolean;
}

@Command({
  name: 'refresh-model',
  description: 'Updates a model and its fields i.e (entity,dto,service,controller files)',
})
export class RefreshModelCommand extends CommandRunner {
  constructor(
    private readonly modelMetadataService: ModelMetadataService,
  ) {
    super();
  }
  private readonly logger = new Logger(RefreshModelCommand.name);

  async run(_passedParam: string[], options?: CommandOptions): Promise<void> {
    const errors = this.validate(options);
    if (errors.length) {
      errors.forEach((error) => this.logger.error(error));
      return;
    }

    const codeGenerationOptions = {
      modelId: options.modelId,
      modelUserKey: options.modelName,
      dryRun: options.dryRun,
    };
    await this.modelMetadataService.generateCode(codeGenerationOptions);
  }

  @Option({
    flags: '-id, --modelId [model ID]',
    description: 'Model ID from the ss_model_metadata table',
  })
  parseModelId(val: string): number {
    return +val;
  }

    // Accept the module name as an argument
    @Option({
      flags: '-n, --modelName [model name]',
      description: 'Model Name from the ss_model_metadata table',
    })
    parseModelName(val: string): string {
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
      if (!options.modelId && !options.modelName) {
        return [new CommandError('Model ID or Model Name is required')];
      }
      return [];
    }
  
}
