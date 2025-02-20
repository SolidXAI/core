import { Injectable, Logger } from '@nestjs/common';
import { CommandService } from './command.service';
import { snakeCase } from "lodash";

export const ADD_MODULE_COMMAND = 'add-module';
export type GenerateModuleOptions = {
  module: string;
};
type FieldOptions = {
  module: string;
  model: string;
  moduleDisplayName: string;
  table?: string;
  dataSource: string;
  fields: any[]; //FIXME This type can be improved
};
export const REMOVE_FIELDS_COMMAND = 'remove-fields';
export const REFRESH_MODEL_COMMAND = 'refresh-model';

enum SYSTEM_FIELDS_TO_IGNORE_FOR_CODE_GENERATION {
  ID = 'id',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  DELETED_AT = 'deletedAt'
}

//TODO Rename to CodeBuilder service
@Injectable()
export class SchematicService {
  private readonly logger = new Logger(SchematicService.name);
  private readonly SCHEMATIC_PROJECT = '@solidstarters/solid-code-builder';
  constructor(private readonly commandService: CommandService) {}

  async executeSchematicCommand(
    command: string,
    options: GenerateModuleOptions | FieldOptions,
    debug = false,
  ): Promise<string> {
    return await this.commandService.executeCommand(
      this.generateSchematicCommand(command, options, debug),
    );
  }

  private generateSchematicCommand(
    command: string,
    options: GenerateModuleOptions | FieldOptions,
    debug: boolean,
  ): string {
    const baseCommand = `schematics ${this.SCHEMATIC_PROJECT}:${command} --debug=${debug}`;
    if (
      command === REMOVE_FIELDS_COMMAND ||
      command === REFRESH_MODEL_COMMAND
    ) {
      const fieldOptions = options as FieldOptions;
      // console.log('fieldOptions', fieldOptions);
      let modelCommand = `${baseCommand} --module=${fieldOptions.module} --model=${fieldOptions.model}`;
      if (fieldOptions.moduleDisplayName) {
        modelCommand += ` --module-display-name=${snakeCase(fieldOptions.moduleDisplayName)}`;
      }

      if (fieldOptions.table) {
        modelCommand += ` --table=${fieldOptions.table}`;
      }
      
      if (fieldOptions.dataSource) {
        modelCommand += ` --data-source=${fieldOptions.dataSource}`;
      }
      
      let fieldCommand = fieldOptions.fields
        .filter((field) => {
          return !Object.values(SYSTEM_FIELDS_TO_IGNORE_FOR_CODE_GENERATION).includes(field.name);
        }) 
        .map((field) => {
          return `--fields='${JSON.stringify(field)}'`;
        })
        .join(' ');
      const schematicCommand =  modelCommand + ' ' + fieldCommand;
      // console.log('schematicCommand', schematicCommand);
      return schematicCommand;
    } else if (command === ADD_MODULE_COMMAND) {
      const moduleOptions = options as GenerateModuleOptions;
      // console.log('moduleOptions', moduleOptions);
      const schematicCommand =  ` ${baseCommand} --module=${moduleOptions.module}`;
      // console.log('schematicCommand', schematicCommand);
      this.logger.log('schematicCommand', schematicCommand);
      return schematicCommand;
    } else {
      throw new Error('Schematic command not supported.');
    }
  }
  
}
