import 'reflect-metadata';
import { SETTINGS_PROVIDER_NAMESPACE, SettingsProvider } from '../decorators/settings-provider.decorator';
import {
  buildSettingKey,
  validateLocalSettingKey,
  validateSettingNamespace,
} from './setting-key.helper';

describe('setting key helpers', () => {
  it('builds a canonical setting key', () => {
    expect(buildSettingKey('acme-payments', 'clientID')).toBe('acme-payments:clientID');
  });

  it('rejects invalid namespaces', () => {
    expect(() => validateSettingNamespace('Acme Payments')).toThrow('Invalid settings provider namespace');
  });

  it('rejects the namespace separator in a local key', () => {
    expect(() => validateLocalSettingKey('acme:clientID')).toThrow('must not contain ":"');
  });

  it('keeps the provider namespace optional', () => {
    @SettingsProvider()
    class LegacyProvider { }

    @SettingsProvider('acme-payments')
    class NamespacedProvider { }

    expect(Reflect.getMetadata(SETTINGS_PROVIDER_NAMESPACE, LegacyProvider)).toBeUndefined();
    expect(Reflect.getMetadata(SETTINGS_PROVIDER_NAMESPACE, NamespacedProvider)).toBe('acme-payments');
  });
});
