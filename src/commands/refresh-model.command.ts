import { forwardRef, Inject, Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { CommandError } from './helper';

interface CommandOptions {
  name: string;
  dryRun?: boolean;
}

@Command({
  name: 'refresh-model',
  description: 'Updates a model and its fields i.e (entity,dto,service,controller files)',
})
export class RefreshModelCommand extends CommandRunner {
  constructor(
    @Inject(forwardRef(() => ModelMetadataService))
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
      modelUserKey: options.name,
      dryRun: options.dryRun,
    };
    await this.modelMetadataService.handleGenerateCode(codeGenerationOptions);
  }

  @Option({
    flags: '-n, --name <model name>',
    description: 'Model name (singularName) from the ss_model_metadata table',
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

  private validate(options: CommandOptions): CommandError[] {
    if (!options.name) {
      return [new CommandError('Model Name is required')];
    }
    return [];
  }

}
