// solid-password.decorator.ts
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";
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
      regex = this.settingService.getConfigValue<SolidCoreSetting>('authenticationPasswordRegex');
    }

    // Message source
    this.lastMessage =
      opts?.message || this.settingService.getConfigValue<SolidCoreSetting>('authenticationPasswordRegexErrorMessage');

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
