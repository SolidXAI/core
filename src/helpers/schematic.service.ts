import { Injectable, Logger } from '@nestjs/common';
import { snakeCase } from "lodash";
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { CommandService } from './command.service';
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
  constructor(private readonly commandService: CommandService, private readonly solidRegistry: SolidRegistry) { }

  async executeSchematicCommand(
    command: string,
    options: GenerateModuleOptions | ModelAndFieldGenerationOptions,
    debug = false,
  ): Promise<string> {
    return await this.commandService.executeCommand(
      this.generateSchematicCommand(command, options, debug),
    );
  }

  private generateSchematicCommand(
    command: string,
    options: GenerateModuleOptions | ModelAndFieldGenerationOptions,
    debug: boolean,
  ): string {
    const baseCommand = `schematics ${this.SCHEMATIC_PROJECT}:${command} --debug=${debug}`;
    if (
      command === REMOVE_FIELDS_COMMAND ||
      command === REFRESH_MODEL_COMMAND
    ) {
      const {fields, ...modelSpecificOptions} = options as ModelAndFieldGenerationOptions;
      const modelCommand = this.buildModelGenerationCommand(baseCommand, modelSpecificOptions);
      const fieldCommand = this.buildFieldGenerationCommand(fields);
      const schematicCommand = modelCommand + ' ' + fieldCommand;
      this.logger.debug('schematicCommand', schematicCommand);
      return schematicCommand;
    } else if (command === ADD_MODULE_COMMAND) {
      const moduleOptions = options as GenerateModuleOptions;
      const schematicCommand = ` ${baseCommand} --module=${moduleOptions.module}`;
      this.logger.debug('schematicCommand', schematicCommand);
      return schematicCommand;
    } else {
      throw new Error('Schematic command not supported.');
    }
  }

  private buildFieldGenerationCommand(fields: FieldMetadata[]) {
    return fields
      .filter((field) => {
        return !this.solidRegistry.getCommonEntityKeys().map(key => key.toString()).includes(field.name);
      })
      .map((field) => {
        return `--fields='${JSON.stringify(field).replace(/'/g, "\\'")}'`;
      })
      .join(' ');
  }

  private buildModelGenerationCommand(baseCommand: string, modelSpecificOptions: ModelGenerationOptions): string {
    let modelCommand = `${baseCommand} --module=${modelSpecificOptions.module} --model=${modelSpecificOptions.model}`;

    // Make below options code generate i.e if option exists then add to command with proper casing
    if (modelSpecificOptions.moduleDisplayName) {
      modelCommand += ` --module-display-name=${snakeCase(modelSpecificOptions.moduleDisplayName)}`;
    }

    if (modelSpecificOptions.table) {
      modelCommand += ` --table=${modelSpecificOptions.table}`;
    }

    if (modelSpecificOptions.dataSource) {
      modelCommand += ` --data-source=${modelSpecificOptions.dataSource}`;
    }

    if (modelSpecificOptions.modelEnableSoftDelete) {
      modelCommand += ` --model-enable-soft-delete=${modelSpecificOptions.modelEnableSoftDelete}`;
    }

    if (modelSpecificOptions.parentModel) {
      modelCommand += ` --parent-model=${modelSpecificOptions.parentModel}`;
    }
    if (modelSpecificOptions.parentModule) {
      modelCommand += ` --parent-module=${modelSpecificOptions.parentModule}`;
    }

    if (modelSpecificOptions.draftPublishWorkflowEnabled) {
      modelCommand += ` --draft-publish-workflow-enabled=${modelSpecificOptions.draftPublishWorkflowEnabled}`;
    }

    if (modelSpecificOptions.isLegacyTable) {
      modelCommand += ` --is-legacy-table=${modelSpecificOptions.isLegacyTable}`;
    }

    if (modelSpecificOptions.dataSourceType) {
      modelCommand += ` --data-source-type=${modelSpecificOptions.dataSourceType}`;
    }
    
    return modelCommand;
  }
}
