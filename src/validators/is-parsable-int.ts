import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsParsableInt(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'isParsableInt',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any, args: ValidationArguments) {
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