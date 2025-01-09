"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const arrayTransformer = ({ value }) => {
    if (value === null || value === undefined)
        return value;
    const parsedValues = value.map(item => {
        const parsedItem = JSON.parse(item);
        return parsedItem;
    });
    return parsedValues ?? parsedValues;
};
exports.default = arrayTransformer;
//# sourceMappingURL=array-transformer.js.map