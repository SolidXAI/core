"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const integerTransformer = ({ value }) => {
    if (value === null || value === undefined)
        return value;
    const parsedValue = parseInt(value, 10);
    return isNaN(parsedValue) ? null : parsedValue;
};
exports.default = integerTransformer;
//# sourceMappingURL=integer-transformer.js.map