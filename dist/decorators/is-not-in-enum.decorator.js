"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsNotInEnum = IsNotInEnum;
const class_validator_1 = require("class-validator");
function IsNotInEnum(enumType, validationOptions) {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            name: 'isNotInEnum',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [enumType],
            validator: {
                validate(value, args) {
                    const enumValues = Object.values(args.constraints[0]);
                    return !enumValues.includes(value);
                },
                defaultMessage(args) {
                    const enumValues = Object.values(args.constraints[0]).join(', ');
                    return `${args.property} should not be one of the following values: ${enumValues}`;
                },
            },
        });
    };
}
//# sourceMappingURL=is-not-in-enum.decorator.js.map