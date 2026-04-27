import { Injectable, Logger } from '@nestjs/common';
import { CommandService, CommandWithArgs } from './command.service';
import { SolidRegistry } from './solid-registry';

export const ADD_MODULE_COMMAND = 'add-module';
export type GenerateModuleOptions = {
  module: string;
};
type ModelGenerationOptions = Omit<ModelAndFieldGenerationOptions, 'fieldNamesForRemoval'>;

type ModelAndFieldGenerationOptions = {
  module: string;
  model: string;
  fieldNamesForRemoval: string[];
};
export const REMOVE_FIELDS_COMMAND = 'remove-fields';
export const REFRESH_MODEL_COMMAND = 'refresh-model';

//TODO Rename to CodeBuilder service
@Injectable()
export class SchematicService {
  private readonly logger = new Logger(SchematicService.name);
  private readonly SCHEMATIC_PROJECT = '@solidxai/code-builder';
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
    // Only forward --debug when explicitly enabled. The Angular schematics
    // CLI treats the *presence* of --debug as truthy (regardless of the
    // assigned value), and once debug is on it forces dry-run mode — so
    // passing `--debug=false` previously made every schematic invocation
    // silently dry-run, leaving "CREATE …" lines in the log but writing
    // nothing to disk.
    const baseArgs = [schematicName, ...(debug ? ['--debug=true'] : [])];

    if (
      command === REMOVE_FIELDS_COMMAND ||
      command === REFRESH_MODEL_COMMAND
    ) {
      const { fieldNamesForRemoval, ...modelSpecificOptions } = options as ModelAndFieldGenerationOptions;
      const modelArgs = this.buildModelGenerationArgs(modelSpecificOptions);
      const fieldArgs: string[] = [];
      if (fieldNamesForRemoval && fieldNamesForRemoval.length > 0) {
        const _fieldArgs = this.buildFieldGenerationArgs(fieldNamesForRemoval);
        fieldArgs.push(..._fieldArgs);
      }
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

  private buildFieldGenerationArgs(fieldNamesForRemoval: string[]): string[] {
    return fieldNamesForRemoval
      .filter((fieldName) => {
        return !this.solidRegistry.getCommonEntityKeys().map(key => key.toString()).includes(fieldName);
      })
      .map((fieldName) => {
        // Using argument array eliminates the need for shell-specific quoting
        return `--field-names-for-removal=${fieldName}`;
      });
  }

  private buildModelGenerationArgs(modelSpecificOptions: ModelGenerationOptions): string[] {
    const args: string[] = [
      `--module=${modelSpecificOptions.module}`,
      `--model=${modelSpecificOptions.model}`,
    ];
    return args;
  }
}
