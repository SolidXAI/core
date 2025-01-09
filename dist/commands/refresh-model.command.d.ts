import { CommandRunner } from 'nest-commander';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { CommandError } from './helper';
interface CommandOptions {
    modelName: string;
    modelId: number;
    dryRun: boolean;
}
export declare class RefreshModelCommand extends CommandRunner {
    private readonly modelMetadataService;
    constructor(modelMetadataService: ModelMetadataService);
    private readonly logger;
    run(_passedParam: string[], options?: CommandOptions): Promise<void>;
    parseModelId(val: string): number;
    parseModelName(val: string): string;
    parseDryRun(val: string): boolean;
    validate(options: CommandOptions): CommandError[];
}
export {};
