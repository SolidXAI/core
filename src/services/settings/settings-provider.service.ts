import { Injectable } from "@nestjs/common";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreSettingsProvider implements ISettingsProvider {
  getSettings() {
    return [
      { key: 'auth.passwordLessAuth', value: true, level: SettingLevel.SystemAdmin }
    ];
  }
}
