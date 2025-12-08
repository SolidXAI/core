import { BadRequestException, Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { CodeGenerationOptions } from '../interfaces';

interface CommandOptions {
  fieldIds: number[];
  modelId: number;
  dryRun: boolean;
}

@Command({
  name: 'remove-fields',
  description: 'Removes fields from a model',
})
export class RemoveFieldsCommand extends CommandRunner {
  constructor(
    private readonly modelMetadataService: ModelMetadataService,
  ) {
    super();
  }
  private readonly logger = new Logger(RemoveFieldsCommand.name);

  async run(_passedParam: string[], options?: CommandOptions): Promise<void> {

    const codeGenerationOptions: CodeGenerationOptions = {
      modelId: options.modelId,
      fieldIdsForRemoval: options.fieldIds,
      dryRun: options.dryRun,
    };

    await this.modelMetadataService.generateRemoveFieldsCode(codeGenerationOptions);
  }

  @Option({
    flags: '-fids, --fieldIds [Array of field IDs]',
    description: 'Json array of Field IDs from the ss_field_metadata table',
    required: true,
  })
  parseFieldIds(val: string): number[] {
    //Check if the value is a json array
    if (!val.startsWith('[') || !val.endsWith(']')) {
      throw new BadRequestException('Field IDs should be a json array');
    }
    return JSON.parse(val).map((id: string) => parseInt(id));
  }

  @Option({
    flags: '-mid, --modelId [model ID]',
    description: 'Model id from the ss_model_metadata table',
    required: true,
  })
  parseModelId(val: string): number {
    return +val;
  }

  @Option({
    flags: '-d, --dryRun [dry run]',
    description: 'Dry run the command',
  })
  parseDryRun(val: string): boolean {
    this.logger.debug(`Dry run : ${val}`);
    return (val === 'false') ? false : true;
  }


}
