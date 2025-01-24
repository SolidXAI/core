export class CommandError {
    error: string;
    param?: string;
    constructor(error: string, param: string = null) {
        this.error = error;
        this.param = param;
    }
    toString() {
        return `[ error: ${this.error}, param: ${this.param} ]`;
    }
}