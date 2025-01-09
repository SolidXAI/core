import { CommandRunner } from 'nest-commander';
import { ModelMetadataService } from 'src/services/model-metadata.service';
interface CommandOptions {
    fieldIds: number[];
    modelId: number;
    dryRun: boolean;
}
export declare class RemoveFieldsCommand extends CommandRunner {
    private readonly modelMetadataService;
    constructor(modelMetadataService: ModelMetadataService);
    private readonly logger;
    run(_passedParam: string[], options?: CommandOptions): Promise<void>;
    parseFieldIds(val: string): number[];
    parseModelId(val: string): number;
    parseDryRun(val: string): boolean;
}
export {};
