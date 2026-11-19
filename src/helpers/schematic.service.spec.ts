import { SchematicService } from './schematic.service';
import { getInstalledCodeBuilderCollection } from './solid-core-dev-paths';

jest.mock('./solid-core-dev-paths', () => ({
  ...jest.requireActual('./solid-core-dev-paths'),
  getInstalledCodeBuilderCollection: jest.fn(() => '/consumer/solid-api/node_modules/@solidxai/code-builder/dist/collection.json'),
}));

describe('SchematicService core mode', () => {
  let commandService: { executeCommandWithArgs: jest.Mock };
  let service: SchematicService;
  const saved = process.env.SOLIDX_CORE_REPO_ROOT;
  const installedCollection = '/consumer/solid-api/node_modules/@solidxai/code-builder/dist/collection.json';

  beforeEach(() => {
    commandService = { executeCommandWithArgs: jest.fn().mockResolvedValue('') };
    const solidRegistry = { getCommonEntityKeys: () => [] } as any;
    service = new SchematicService(commandService as any, solidRegistry);
    delete process.env.SOLIDX_CORE_REPO_ROOT;
    (getInstalledCodeBuilderCollection as jest.Mock).mockClear();
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.SOLIDX_CORE_REPO_ROOT;
    else process.env.SOLIDX_CORE_REPO_ROOT = saved;
  });

  const run = (module: string) =>
    service.executeSchematicCommand('refresh-model', { module, model: 'user', fieldNamesForRemoval: [] } as any);

  it('uses the package name and inherits cwd when core mode is off', async () => {
    await run('solid-core');
    const sent = commandService.executeCommandWithArgs.mock.calls[0][0];
    expect(sent.args[0]).toBe('@solidxai/code-builder:refresh-model');
    expect(sent.args).not.toContain('--no-dry-run');
    expect(sent.cwd).toBeUndefined();
  });

  it('runs solid-core from the core repo with the installed code-builder', async () => {
    process.env.SOLIDX_CORE_REPO_ROOT = '/Users/ll/projects/core';
    await run('solid-core');
    const sent = commandService.executeCommandWithArgs.mock.calls[0][0];
    expect(sent.args[0]).toBe(`${installedCollection}:refresh-model`);
    expect(sent.args).toContain('--no-dry-run');
    expect(sent.cwd).toBe('/Users/ll/projects/core');
  });

  it('leaves non-core modules alone in core mode', async () => {
    process.env.SOLIDX_CORE_REPO_ROOT = '/Users/ll/projects/core';
    await run('library');
    const sent = commandService.executeCommandWithArgs.mock.calls[0][0];
    expect(sent.args[0]).toBe('@solidxai/code-builder:refresh-model');
    expect(sent.cwd).toBeUndefined();
  });

  it('refuses when the installed code-builder cannot be found', async () => {
    process.env.SOLIDX_CORE_REPO_ROOT = '/Users/ll/projects/core';
    (getInstalledCodeBuilderCollection as jest.Mock).mockImplementationOnce(() => {
      throw new Error('The installed @solidxai/code-builder has no collection.');
    });
    await expect(run('solid-core')).rejects.toThrow('has no collection');
    expect(commandService.executeCommandWithArgs).not.toHaveBeenCalled();
  });
});
