import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SettingLevel } from '../interfaces';
import { SettingService } from './setting.service';

function buildService(activeUser: { permissions?: string[] } | null = null) {
  const requestContextService = {
    getActiveUser: jest.fn(() => activeUser),
  };

  const service = new SettingService(
    {} as any,
    {} as any,
    { getSettingsProviders: () => [] } as any,
    {} as any,
    {} as any,
    requestContextService as any,
    {} as any,
  );

  return { service, requestContextService };
}

function primeSetting(
  service: SettingService,
  setting: {
    key: string;
    value: unknown;
    level: SettingLevel;
    encrypted?: boolean;
  },
) {
  (service as any).settingsByKey = new Map([[setting.key, setting]]);
}

describe('SettingService.getSettingByKey', () => {
  it('returns a non-encrypted setting without requiring special permission', () => {
    const { service } = buildService({ permissions: [] });
    primeSetting(service, {
      key: 'solidXGenAiCodeBuilderConfig',
      value: '{"model":"gpt-5"}',
      level: SettingLevel.SystemAdminEditable,
      encrypted: false,
    });

    expect(service.getSettingByKey('solidXGenAiCodeBuilderConfig')).toEqual({
      key: 'solidXGenAiCodeBuilderConfig',
      value: '{"model":"gpt-5"}',
    });
  });

  it('throws when the setting does not exist', () => {
    const { service } = buildService({ permissions: [] });
    (service as any).settingsByKey = new Map();

    expect(() => service.getSettingByKey('missing')).toThrow(NotFoundException);
  });

  it('rejects system-env settings', () => {
    const { service } = buildService({ permissions: ['settings:view_encrypted'] });
    primeSetting(service, {
      key: 'databaseUrl',
      value: 'postgresql://secret',
      level: SettingLevel.SystemEnv,
      encrypted: false,
    });

    expect(() => service.getSettingByKey('databaseUrl')).toThrow(ForbiddenException);
  });

  it('rejects encrypted settings without the encrypted-settings permission', () => {
    const { service } = buildService({ permissions: [] });
    primeSetting(service, {
      key: 'mcpApiKey',
      value: 'secret-value',
      level: SettingLevel.SystemAdminEditable,
      encrypted: true,
    });

    expect(() => service.getSettingByKey('mcpApiKey')).toThrow(ForbiddenException);
  });

  it('returns encrypted settings when the caller has the encrypted-settings permission', () => {
    const { service } = buildService({ permissions: ['settings:view_encrypted'] });
    primeSetting(service, {
      key: 'mcpApiKey',
      value: 'secret-value',
      level: SettingLevel.SystemAdminEditable,
      encrypted: true,
    });

    expect(service.getSettingByKey('mcpApiKey')).toEqual({
      key: 'mcpApiKey',
      value: 'secret-value',
    });
  });
});
