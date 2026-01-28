import { Injectable, Logger } from '@nestjs/common';
import { snakeCase } from "lodash";
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { CommandService, CommandWithArgs } from './command.service';
import { SolidRegistry } from './solid-registry';

export const ADD_MODULE_COMMAND = 'add-module';
export type GenerateModuleOptions = {
  module: string;
};
type ModelGenerationOptions = Omit<ModelAndFieldGenerationOptions, 'fields'>;

type ModelAndFieldGenerationOptions = {
  module: string;
  model: string;
  moduleDisplayName: string;
  table?: string;
  dataSource: string;
  modelEnableSoftDelete?: boolean;
  parentModel?: string;
  parentModule?: string;
  draftPublishWorkflowEnabled?: boolean;
  isLegacyTable?: boolean;
  isLegacyTableWithId?: boolean;
  dataSourceType?: string;
  fields: FieldMetadata[]; //FIXME This type can be improved
};
export const REMOVE_FIELDS_COMMAND = 'remove-fields';
export const REFRESH_MODEL_COMMAND = 'refresh-model';

//TODO Rename to CodeBuilder service
@Injectable()
export class SchematicService {
  private readonly logger = new Logger(SchematicService.name);
  private readonly SCHEMATIC_PROJECT = '@solidstarters/solid-code-builder';
  private readonly SCHEMATICS_COMMAND = 'schematics';

  constructor(private readonly commandService: CommandService, private readonly solidRegistry: SolidRegistry) { }

  async executeSchematicCommand(
    command: string,
    options: GenerateModuleOptions | ModelAndFieldGenerationOptions,
    debug = false,
  ): Promise<string> {
    const commandWithArgs = this.generateSchematicCommand(command, options, debug);
    return await this.commandService.executeCommandWithArgs(commandWithArgs);
  }

  private generateSchematicCommand(
    command: string,
    options: GenerateModuleOptions | ModelAndFieldGenerationOptions,
    debug: boolean,
  ): CommandWithArgs {
    const schematicName = `${this.SCHEMATIC_PROJECT}:${command}`;
    const baseArgs = [schematicName, `--debug=${debug}`];

    if (
      command === REMOVE_FIELDS_COMMAND ||
      command === REFRESH_MODEL_COMMAND
    ) {
      const { fields, ...modelSpecificOptions } = options as ModelAndFieldGenerationOptions;
      const modelArgs = this.buildModelGenerationArgs(modelSpecificOptions);
      const fieldArgs = this.buildFieldGenerationArgs(fields);
      const args = [...baseArgs, ...modelArgs, ...fieldArgs];
      this.logger.debug('schematicCommand args', args);
      return { command: this.SCHEMATICS_COMMAND, args };
    } else if (command === ADD_MODULE_COMMAND) {
      const moduleOptions = options as GenerateModuleOptions;
      const args = [...baseArgs, `--module=${moduleOptions.module}`];
      this.logger.debug('schematicCommand args', args);
      return { command: this.SCHEMATICS_COMMAND, args };
    } else {
      throw new Error('Schematic command not supported.');
    }
  }

  private buildFieldGenerationArgs(fields: FieldMetadata[]): string[] {
    return fields
      .filter((field) => {
        return !this.solidRegistry.getCommonEntityKeys().map(key => key.toString()).includes(field.name);
      })
      .map((field) => {
        // Using argument array eliminates the need for shell-specific quoting
        return `--fields=${JSON.stringify(field)}`;
      });
  }

  private buildModelGenerationArgs(modelSpecificOptions: ModelGenerationOptions): string[] {
    const args: string[] = [
      `--module=${modelSpecificOptions.module}`,
      `--model=${modelSpecificOptions.model}`,
    ];

    if (modelSpecificOptions.moduleDisplayName) {
      args.push(`--module-display-name=${snakeCase(modelSpecificOptions.moduleDisplayName)}`);
    }

    if (modelSpecificOptions.table) {
      args.push(`--table=${modelSpecificOptions.table}`);
    }

    if (modelSpecificOptions.dataSource) {
      args.push(`--data-source=${modelSpecificOptions.dataSource}`);
    }

    if (modelSpecificOptions.modelEnableSoftDelete) {
      args.push(`--model-enable-soft-delete=${modelSpecificOptions.modelEnableSoftDelete}`);
    }

    if (modelSpecificOptions.parentModel) {
      args.push(`--parent-model=${modelSpecificOptions.parentModel}`);
    }

    if (modelSpecificOptions.parentModule) {
      args.push(`--parent-module=${modelSpecificOptions.parentModule}`);
    }

    if (modelSpecificOptions.draftPublishWorkflowEnabled) {
      args.push(`--draft-publish-workflow-enabled=${modelSpecificOptions.draftPublishWorkflowEnabled}`);
    }

    if (modelSpecificOptions.isLegacyTable) {
      args.push(`--is-legacy-table=${modelSpecificOptions.isLegacyTable}`);
    }

    if (modelSpecificOptions.isLegacyTableWithId) {
      args.push(`--is-legacy-table-with-id=${modelSpecificOptions.isLegacyTableWithId}`);
    }

    if (modelSpecificOptions.dataSourceType) {
      args.push(`--data-source-type=${modelSpecificOptions.dataSourceType}`);
    }

    return args;
  }
}
