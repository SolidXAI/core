// solid-password.decorator.ts
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { SettingService } from 'src/services/setting.service';

interface SolidPasswordOptions extends ValidationOptions {
  regex?: RegExp | string;
  message?: string;
}

@ValidatorConstraint({ async: true })
@Injectable()
export class SolidPasswordConstraint implements ValidatorConstraintInterface {
  private lastMessage = 'Password does not meet complexity requirements';

  constructor(private readonly settingService: SettingService) { }

  async validate(value: string, args: ValidationArguments) {
    if (!value) return false;

    const opts = args.constraints[0] as SolidPasswordOptions;

    // Regex source
    let regex = opts?.regex;
    if (!regex) {
      regex = await this.settingService.getConfigValue("iam", 'authenticationPasswordRegex');
    }

    // Message source
    this.lastMessage =
      opts?.message || await this.settingService.getConfigValue("iam", 'authenticationPasswordRegexErrorMessage');

    return new RegExp(regex).test(value);
  }

  defaultMessage(args?: ValidationArguments): string {
    return this.lastMessage;
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
