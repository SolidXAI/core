import 'reflect-metadata';
import { SettingsProvider } from '../decorators/settings-provider.decorator';
import { SettingLevel } from '../interfaces';
import { SettingService } from './setting.service';

function createServiceWithProviders(providers: Array<{ name: string; metatype: Function; instance: object }>) {
  const registry = {
    getSettingsProviders: () => providers,
  };

  return new SettingService(
    null as any,
    null as any,
    registry as any,
    null as any,
    null as any,
    null as any,
    null as any,
  );
}

function setting(moduleName: string, key: string, value: unknown) {
  return {
    moduleName,
    key,
    value,
    level: SettingLevel.SystemAdminEditable,
  };
}

describe('SettingService provider namespaces', () => {
  it('preserves legacy keys and qualifies opt-in provider keys', () => {
    @SettingsProvider()
    class LegacyProvider {
      getSettings() {
        return [setting('solid-core', 'clientID', 'core')];
      }
    }

    @SettingsProvider('nbf')
    class NbfProvider {
      getSettings() {
        return [setting('nbf', 'clientID', 'nbf')];
      }
    }

    const service = createServiceWithProviders([
      { name: LegacyProvider.name, metatype: LegacyProvider, instance: new LegacyProvider() },
      { name: NbfProvider.name, metatype: NbfProvider, instance: new NbfProvider() },
    ]);

    const definitions = (service as any).getAllSettingsFromProviders();
    expect(definitions.map(({ key }: { key: string }) => key)).toEqual([
      'clientID',
      'nbf:clientID',
    ]);

    // Provider-owned objects must not be mutated or double-prefixed on refresh.
    const refreshed = (service as any).getAllSettingsFromProviders();
    expect(refreshed[1].key).toBe('nbf:clientID');
  });

  it('allows providers to share a namespace when their local keys differ', () => {
    @SettingsProvider('nbf')
    class FirstProvider {
      getSettings() {
        return [setting('nbf', 'first', true)];
      }
    }

    @SettingsProvider('nbf')
    class SecondProvider {
      getSettings() {
        return [setting('nbf', 'second', true)];
      }
    }

    const service = createServiceWithProviders([
      { name: FirstProvider.name, metatype: FirstProvider, instance: new FirstProvider() },
      { name: SecondProvider.name, metatype: SecondProvider, instance: new SecondProvider() },
    ]);

    const definitions = (service as any).getAllSettingsFromProviders();
    expect(definitions.map(({ key }: { key: string }) => key)).toEqual([
      'nbf:first',
      'nbf:second',
    ]);
  });

  it('rejects duplicate local keys in one namespace', () => {
    @SettingsProvider('nbf')
    class NbfProvider {
      getSettings() {
        return [
          setting('nbf', 'clientID', 'first'),
          setting('nbf', 'clientID', 'second'),
        ];
      }
    }

    const service = createServiceWithProviders([
      { name: NbfProvider.name, metatype: NbfProvider, instance: new NbfProvider() },
    ]);

    expect(() => (service as any).getAllSettingsFromProviders())
      .toThrow('Duplicate effective setting key "nbf:clientID"');
  });

  it('reads a canonical key through forModule()', () => {
    const service = createServiceWithProviders([]);
    (service as any).settingsByKey = new Map([
      ['nbf:clientID', setting('nbf', 'nbf:clientID', 'configured-value')],
    ]);

    expect(service.forModule('nbf').get<string>('clientID')).toBe('configured-value');
  });
});
