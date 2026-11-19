import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ModuleMetadataHelperService } from './module-metadata-helper.service';

describe('ModuleMetadataHelperService solid-core path', () => {
  const saved = process.env.SOLIDX_CORE_REPO_ROOT;
  let coreDir: string;
  let helper: ModuleMetadataHelperService;

  beforeEach(() => {
    coreDir = fs.mkdtempSync(path.join(os.tmpdir(), 'core-meta-'));
    fs.mkdirSync(path.join(coreDir, 'src', 'seeders', 'seed-data'), { recursive: true });
    fs.writeFileSync(path.join(coreDir, 'src', 'seeders', 'seed-data', 'solid-core-metadata.json'), '{}');
    const fileService = { exists: (p: string) => Promise.resolve(fs.existsSync(p)) } as any;
    helper = new ModuleMetadataHelperService(fileService);
    delete process.env.SOLIDX_CORE_REPO_ROOT;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.SOLIDX_CORE_REPO_ROOT;
    else process.env.SOLIDX_CORE_REPO_ROOT = saved;
  });

  it('returns the core repo metadata file in core mode', async () => {
    process.env.SOLIDX_CORE_REPO_ROOT = coreDir;
    const file = await helper.getModuleMetadataFilePath('solid-core');
    expect(file).toBe(path.join(path.resolve(coreDir), 'src', 'seeders', 'seed-data', 'solid-core-metadata.json'));
  });

  it('does not use the core repo file outside core mode', async () => {
    const file = await helper.getModuleMetadataFilePath('solid-core');
    expect(file.startsWith(path.resolve(coreDir))).toBe(false);
  });
});
