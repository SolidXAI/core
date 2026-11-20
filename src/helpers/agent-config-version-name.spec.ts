import { buildAgentConfigVersionName } from './agent-config-version-name';

describe('buildAgentConfigVersionName', () => {
  const now = new Date('2026-11-06T22:05:00Z');
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SOLIDX_WALL_TIME_TIMEZONE;
    delete process.env.SOLIDX_TIMEZONE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('appends the timestamp to a trimmed name', () => {
    expect(buildAgentConfigVersionName('  Support flow ', 3, now)).toBe('Support flow_20261106_2205');
  });

  it.each([undefined, '', '   '])('falls back to the version number when the name is %p', (name) => {
    expect(buildAgentConfigVersionName(name, 3, now)).toBe('v3_20261106_2205');
  });

  it('uses the configured timezone, including when the date rolls over', () => {
    process.env.SOLIDX_TIMEZONE = 'Asia/Kolkata';
    expect(buildAgentConfigVersionName('Support flow', 3, now)).toBe('Support flow_20261107_0335');
  });

  it('prefers the wall time timezone over the general timezone', () => {
    process.env.SOLIDX_TIMEZONE = 'Asia/Kolkata';
    process.env.SOLIDX_WALL_TIME_TIMEZONE = 'America/New_York';
    expect(buildAgentConfigVersionName('Support flow', 3, now)).toBe('Support flow_20261106_1705');
  });
});
