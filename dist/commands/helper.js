"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandError = void 0;
class CommandError {
    constructor(error, param = null) {
        this.error = error;
        this.param = param;
    }
    toString() {
        return `[ error: ${this.error}, param: ${this.param} ]`;
    }
}
exports.CommandError = CommandError;
//# sourceMappingURL=helper.js.map