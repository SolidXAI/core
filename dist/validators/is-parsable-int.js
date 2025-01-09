"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsParsableInt = IsParsableInt;
const class_validator_1 = require("class-validator");
function IsParsableInt(validationOptions) {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            name: 'isParsableInt',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value, args) {
                    const parsedValue = parseInt(value, 10);
                    return Number.isInteger(parsedValue);
                },
                defaultMessage() {
                    return 'Value must be a parsable integer';
                },
            },
        });
    };
}
//# sourceMappingURL=is-parsable-int.js.map