import { CommandRunner } from 'nest-commander';
import { ModelMetadataService } from '../services/model-metadata.service';
import { ModuleMetadataService } from '../services/module-metadata.service';
import { CommandError } from './helper';
interface CommandOptions {
    moduleId: number;
    moduleName: string;
    dryRun: boolean;
}
export declare class RefreshModuleCommand extends CommandRunner {
    private readonly moduleMetadataService;
    private readonly modelMetadataService;
    constructor(moduleMetadataService: ModuleMetadataService, modelMetadataService: ModelMetadataService);
    private readonly logger;
    run(_passedParam: string[], options?: CommandOptions): Promise<void>;
    parseModuleId(val: string): number;
    parseModuleName(val: string): string;
    parseDryRun(val: string): boolean;
    validate(options: CommandOptions): CommandError[];
}
export {};
