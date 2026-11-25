import { Injectable, Logger } from '@nestjs/common';
import { CommandService, CommandWithArgs } from './command.service';
import { SolidRegistry } from './solid-registry';
import { SOLID_CORE_MODULE_NAME } from '../constants';
import { getCoreRepoRoot, getInstalledCodeBuilderCollection } from './solid-core-dev-paths';

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
    // Core mode (solidctl --core): solid-core models generate into the core repo, using the local code-builder build.
    const coreRoot = options.module === SOLID_CORE_MODULE_NAME ? getCoreRepoRoot() : undefined;
    // Core mode runs the installed code-builder by file path, so the generator runs from the core repo directory.
    const collection = coreRoot ? getInstalledCodeBuilderCollection() : this.SCHEMATIC_PROJECT;
    if (coreRoot) {
      this.logger.log(`Core mode: generating solid-core code into ${coreRoot} using ${collection}`);
    }
    const schematicName = `${collection}:${command}`;
    // Only forward --debug when explicitly enabled. The Angular schematics
    // CLI treats the *presence* of --debug as truthy (regardless of the
    // assigned value), and once debug is on it forces dry-run mode — so
    // passing `--debug=false` previously made every schematic invocation
    // silently dry-run, leaving "CREATE …" lines in the log but writing
    // nothing to disk.
    // A local collection path (core mode) makes the schematics CLI default to debug, which implies dry run.
    // Pass --no-dry-run so core-mode runs actually write files. (`--dry-run=false` does not work: the CLI's
    // parseArgs reads it as the string "false", which is truthy.)
    const baseArgs = [schematicName, ...(debug ? ['--debug=true'] : coreRoot ? ['--no-dry-run'] : [])];

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
      return { command: this.SCHEMATICS_COMMAND, args, cwd: coreRoot };
    } else if (command === ADD_MODULE_COMMAND) {
      const moduleOptions = options as GenerateModuleOptions;
      const args = [...baseArgs, `--module=${moduleOptions.module}`];
      this.logger.debug('schematicCommand args', args);
      return { command: this.SCHEMATICS_COMMAND, args, cwd: coreRoot };
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
