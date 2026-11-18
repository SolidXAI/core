import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SchematicService } from './schematic.service';

describe('SchematicService core mode', () => {
  let commandService: { executeCommandWithArgs: jest.Mock };
  let service: SchematicService;
  const saved = { core: process.env.SOLIDX_CORE_REPO_ROOT, builder: process.env.SOLIDX_CODE_BUILDER_ROOT };
  let coreDir: string;
  let builderDir: string;

  beforeEach(() => {
    coreDir = fs.mkdtempSync(path.join(os.tmpdir(), 'core-'));
    builderDir = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-'));
    fs.mkdirSync(path.join(builderDir, 'dist'));
    fs.writeFileSync(path.join(builderDir, 'dist', 'collection.json'), '{}');
    commandService = { executeCommandWithArgs: jest.fn().mockResolvedValue('') };
    const solidRegistry = { getCommonEntityKeys: () => [] } as any;
    service = new SchematicService(commandService as any, solidRegistry);
    delete process.env.SOLIDX_CORE_REPO_ROOT;
    delete process.env.SOLIDX_CODE_BUILDER_ROOT;
  });

  afterEach(() => {
    process.env.SOLIDX_CORE_REPO_ROOT = saved.core;
    process.env.SOLIDX_CODE_BUILDER_ROOT = saved.builder;
    if (saved.core === undefined) delete process.env.SOLIDX_CORE_REPO_ROOT;
    if (saved.builder === undefined) delete process.env.SOLIDX_CODE_BUILDER_ROOT;
  });

  const run = (module: string) =>
    service.executeSchematicCommand('refresh-model', { module, model: 'user', fieldNamesForRemoval: [] } as any);

  it('uses the installed code-builder and inherits cwd when core mode is off', async () => {
    await run('solid-core');
    const sent = commandService.executeCommandWithArgs.mock.calls[0][0];
    expect(sent.args[0]).toBe('@solidxai/code-builder:refresh-model');
    expect(sent.args).not.toContain('--no-dry-run');
    expect(sent.cwd).toBeUndefined();
  });

  it('runs solid-core from the core repo with the local code-builder', async () => {
    process.env.SOLIDX_CORE_REPO_ROOT = coreDir;
    process.env.SOLIDX_CODE_BUILDER_ROOT = builderDir;
    await run('solid-core');
    const sent = commandService.executeCommandWithArgs.mock.calls[0][0];
    expect(sent.args[0]).toBe(`${path.join(builderDir, 'dist', 'collection.json')}:refresh-model`);
    expect(sent.args).toContain('--no-dry-run');
    expect(sent.cwd).toBe(path.resolve(coreDir));
  });

  it('leaves non-core modules alone in core mode', async () => {
    process.env.SOLIDX_CORE_REPO_ROOT = coreDir;
    process.env.SOLIDX_CODE_BUILDER_ROOT = builderDir;
    await run('library');
    const sent = commandService.executeCommandWithArgs.mock.calls[0][0];
    expect(sent.args[0]).toBe('@solidxai/code-builder:refresh-model');
    expect(sent.cwd).toBeUndefined();
  });

  it('refuses when the local code-builder is not built', async () => {
    fs.unlinkSync(path.join(builderDir, 'dist', 'collection.json'));
    process.env.SOLIDX_CORE_REPO_ROOT = coreDir;
    process.env.SOLIDX_CODE_BUILDER_ROOT = builderDir;
    await expect(run('solid-core')).rejects.toThrow('is not built');
    expect(commandService.executeCommandWithArgs).not.toHaveBeenCalled();
  });
});
