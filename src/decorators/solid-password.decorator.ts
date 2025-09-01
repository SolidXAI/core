// solid-password.decorator.ts
import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { iamConfig } from '../config/iam.config';

interface SolidPasswordOptions extends ValidationOptions {
    regex?: RegExp | string;
    message ?: string;
}

@ValidatorConstraint({ async: false })
@Injectable()
export class SolidPasswordConstraint implements ValidatorConstraintInterface {
    validate(value: string, args: ValidationArguments) {
        if (!value) return false;

        const opts = args.constraints[0] as SolidPasswordOptions;

        // priority: decorator-provided regex → iamConfig().PASSWORD_REGEX
        const regex = opts?.regex || iamConfig().PASSWORD_REGEX;

        return new RegExp(regex).test(value);
    }

    defaultMessage(args?: ValidationArguments): string {
        const opts = args?.constraints?.[0] as SolidPasswordOptions;

        // Just use the string from decorator if passed, otherwise use iamConfig
        return opts?.message || iamConfig().PASSWORD_COMPLEXITY_DESC;
    }
}

export function SolidPasswordRegex(
    options?: SolidPasswordOptions,
): PropertyDecorator {
    return (object: Object, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options,
            constraints: [options],
            validator: SolidPasswordConstraint,
        });
    };
}
