import { BadRequestException, forwardRef, Inject, Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { CommandError } from './helper';
import { In } from 'typeorm';

interface CommandOptions {
  name?: string;
  id?: number;
  fieldIds?: number[];
  fieldNames?: string[];
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
      modelId: options.id,
      modelUserKey: options.name,
      dryRun: options.dryRun,
      fieldIdsForRefresh: options.fieldIds,
      fieldNamesForRefresh: options.fieldNames,
    };
    await this.modelMetadataService.handleGenerateCode(codeGenerationOptions);
  }

  // Accept the model ID as an argument
  @Option({
    flags: '-i, --id [model ID]',
    description: 'Model ID from the ss_model_metadata table',
  })
  parseId(val: string): number {
    return +val;
  }

  // Accept the module name as an argument
  @Option({
    flags: '-n, --name [model name]',
    description: 'Model Name from the ss_model_metadata table',
  })
  parseName(val: string): string {
    return val;
  }

  // Accept dry run as an argument
  @Option({
    flags: '-d, --dryRun [dry run]',
    description: 'Dry run the command',
  })
  parseDryRun(val: string): boolean {
    this.logger.debug(`Dry run : ${val}`);
    return (val === 'false') ? false : true;
  }

  // Accept field IDs as an argument
  @Option({
    flags: '-fids, --fieldIds [Array of field IDs]',
    description: 'Json array of Field IDs from the ss_field_metadata table',
  })
  parseFieldIds(val: string): number[] {
    //Check if the value is a json array
    if (!val.startsWith('[') || !val.endsWith(']')) {
      throw new BadRequestException('Field IDs should be a json array');
    }
    return JSON.parse(val).map((id: string) => parseInt(id));
  }

  // Accept field Names as an argument
  @Option({
    flags: '-fnames, --fieldNames [Array of field Names]',
    description: 'Json array of Field Names from the ss_field_metadata table',
  })
  parseFieldNames(val: string): string[] {
    //Check if the value is a json array
    if (!val.startsWith('[') || !val.endsWith(']')) {
      throw new BadRequestException('Field Names should be a json array');
    }
    return JSON.parse(val).map((name: string) => name.toString());
  }

  // Validate the options passed
  private validate(options: CommandOptions): CommandError[] {
    if (!options.id && !options.name) {
      return [new CommandError('Model ID or Model Name is required')];
    }
    return [];
  }

}
