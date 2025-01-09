import { CommandRunner } from 'nest-commander';
import { SolidRegistry } from 'src/helpers/solid-registry';
interface SeedCommandOptions {
    seeder?: string;
}
export declare class SeedCommand extends CommandRunner {
    private readonly solidRegistry;
    private readonly logger;
    constructor(solidRegistry: SolidRegistry);
    run(passedParam: string[], options?: SeedCommandOptions): Promise<void>;
    parseString(val: string): string;
}
export {};
