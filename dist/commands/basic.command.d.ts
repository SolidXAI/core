import { CommandRunner } from 'nest-commander';
interface BasicCommandOptions {
    string?: string;
    boolean?: boolean;
    number?: number;
}
export declare class BasicCommand extends CommandRunner {
    constructor();
    run(passedParam: string[], options?: BasicCommandOptions): Promise<void>;
    parseNumber(val: string): number;
    parseString(val: string): string;
    parseBoolean(val: string): boolean;
    runWithString(param: string[], option: string): void;
    runWithNumber(param: string[], option: number): void;
    runWithBoolean(param: string[], option: boolean): void;
    runWithNone(param: string[]): void;
}
export {};
