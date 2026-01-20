import { SetMetadata } from "@nestjs/common";

export const IS_SETTINGS_PROVIDER = 'IS_SETTINGS_PROVIDER';


export const SettingsProvider = () => SetMetadata(IS_SETTINGS_PROVIDER, true);

