import { ValidationOptions, ValidationArguments, registerDecorator } from "class-validator";

// Custom decorator to check if the value is NOT in the enum
export function IsNotInEnum(enumType: object, validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
      registerDecorator({
        name: 'isNotInEnum',
        target: object.constructor,
        propertyName: propertyName,
        options: validationOptions,
        constraints: [enumType],
        validator: {
          validate(value: any, args: ValidationArguments) {
            const enumValues = Object.values(args.constraints[0]);
            return !enumValues.includes(value); // Return true if value is NOT in the enum
          },
          defaultMessage(args: ValidationArguments) {
            const enumValues = Object.values(args.constraints[0]).join(', ');
            return `${args.property} should not be one of the following values: ${enumValues}`;
          },
        },
      });
    };
  }