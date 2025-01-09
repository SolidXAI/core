import { CommandService } from './command.service';
export declare const ADD_MODULE_COMMAND = "add-module";
export type GenerateModuleOptions = {
    module: string;
};
type FieldOptions = {
    module: string;
    model: string;
    moduleDisplayName: string;
    table?: string;
    dataSource: string;
    fields: any[];
};
export declare const REMOVE_FIELDS_COMMAND = "remove-fields";
export declare const REFRESH_MODEL_COMMAND = "refresh-model";
export declare class SchematicService {
    private readonly commandService;
    private readonly logger;
    private readonly SCHEMATIC_PROJECT;
    constructor(commandService: CommandService);
    executeSchematicCommand(command: string, options: GenerateModuleOptions | FieldOptions, debug?: boolean): Promise<string>;
    private generateSchematicCommand;
}
export {};
