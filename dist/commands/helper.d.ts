export declare class CommandError {
    error: string;
    param?: string;
    constructor(error: string, param?: string);
    toString(): string;
}
