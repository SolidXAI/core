import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { SolidCoreDefaultSettingsProvider } from 'src/services/settings/default-settings-provider.service';
import { TestDataController } from './test-data.controller';

describe('TestDataController', () => {
  const summary = { rolesProcessed: 0, usersProcessed: 0, data: { created: 1, updated: 0, skipped: 0 } };
  let loadTestData: jest.Mock;
  let settings: Record<string, unknown>;
  let controller: TestDataController;

  beforeEach(() => {
    settings = { testDataEndpointEnabled: true };
    loadTestData = jest.fn(async () => summary);
    const settingService = { getConfigValue: jest.fn((key: string) => settings[key] ?? null) };
    controller = new TestDataController({ loadTestData } as any, settingService as any);
  });

  it('returns the load summary', async () => {
    const testing = { data: [] };
    await expect(controller.load({ testing })).resolves.toBe(summary);
    expect(loadTestData).toHaveBeenCalledWith(testing);
  });

  it('responds 404 and loads nothing when the setting is off', async () => {
    settings.testDataEndpointEnabled = false;

    await expect(controller.load({ testing: {} })).rejects.toBeInstanceOf(NotFoundException);
    expect(loadTestData).not.toHaveBeenCalled();
  });

  it('responds 404 when the setting is not present', async () => {
    delete settings.testDataEndpointEnabled;

    await expect(controller.load({ testing: {} })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('responds 400 when the body has no testing object', async () => {
    await expect(controller.load({} as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.load(undefined as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(loadTestData).not.toHaveBeenCalled();
  });

  it('responds 409 to a second load while one is running, and accepts a new one afterwards', async () => {
    let finish!: (value: typeof summary) => void;
    loadTestData.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));

    const first = controller.load({ testing: { data: [] } });
    await expect(controller.load({ testing: { data: [] } })).rejects.toBeInstanceOf(ConflictException);
    finish(summary);
    await first;

    await expect(controller.load({ testing: { data: [] } })).resolves.toBe(summary);
  });

  it('releases the lock when a load fails', async () => {
    loadTestData.mockRejectedValueOnce(new Error('boom'));
    await expect(controller.load({ testing: { data: [] } })).rejects.toBeInstanceOf(UnprocessableEntityException);

    await expect(controller.load({ testing: { data: [] } })).resolves.toBe(summary);
  });

  it('responds 422 with the message when the load fails', async () => {
    loadTestData.mockRejectedValueOnce(new Error('Test data relation not found: author.authorCode=A9'));

    const failure = controller.load({ testing: { data: [] } });
    await expect(failure).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(failure).rejects.toThrow('Test data relation not found: author.authorCode=A9');
  });
});

describe('testDataEndpointEnabled setting', () => {
  const find = () =>
    new SolidCoreDefaultSettingsProvider().getSettings().find((s: any) => s.key === 'testDataEndpointEnabled') as any;
  const original = process.env.SOLIDX_TEST_DATA_ENDPOINT_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.SOLIDX_TEST_DATA_ENDPOINT_ENABLED;
    else process.env.SOLIDX_TEST_DATA_ENDPOINT_ENABLED = original;
  });

  it('is on only when SOLIDX_TEST_DATA_ENDPOINT_ENABLED is "true"', () => {
    process.env.SOLIDX_TEST_DATA_ENDPOINT_ENABLED = 'true';
    expect(find().value).toBe(true);

    process.env.SOLIDX_TEST_DATA_ENDPOINT_ENABLED = 'yes';
    expect(find().value).toBe(false);

    delete process.env.SOLIDX_TEST_DATA_ENDPOINT_ENABLED;
    expect(find().value).toBe(false);
  });

  it('is SystemEnv, so the settings screen and settings API never return it', () => {
    expect(find().level).toBe('system-env');
  });
});
