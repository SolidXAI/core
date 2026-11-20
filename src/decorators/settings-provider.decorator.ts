import { applyDecorators, SetMetadata } from "@nestjs/common";

export const IS_SETTINGS_PROVIDER = 'IS_SETTINGS_PROVIDER';
export const SETTINGS_PROVIDER_NAMESPACE = 'SETTINGS_PROVIDER_NAMESPACE';

export const SettingsProvider = (namespace?: string) => applyDecorators(
  SetMetadata(IS_SETTINGS_PROVIDER, true),
  SetMetadata(SETTINGS_PROVIDER_NAMESPACE, namespace),
);

