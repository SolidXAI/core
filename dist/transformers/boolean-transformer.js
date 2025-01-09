"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const transformBoolean = ({ value }) => {
    if (typeof (value) === "boolean") {
        return value;
    }
    else if (value === 'true') {
        return true;
    }
    else {
        return false;
    }
};
exports.default = transformBoolean;
//# sourceMappingURL=boolean-transformer.js.map