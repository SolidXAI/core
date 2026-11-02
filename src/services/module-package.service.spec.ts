import { BadRequestException } from '@nestjs/common';
import archiver from 'archiver';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { CommandService } from 'src/helpers/command.service';
import { ModulePackageService } from './module-package.service';

const MODULE = 'test-hub';
const API = `solid-api/src/${MODULE}`;
const UI = `solid-ui/src/${MODULE}`;
const METADATA = `${API}/metadata/${MODULE}-metadata.json`;

const USER_DATA = { solidApiPaths: ['metadata/test-scenarios'], metadataKeys: ['testHubApplications'] };

type PackageSpec = {
    version: string;
    // Files by path inside the module (api side unless prefixed with "ui:").
    files: Record<string, string>;
    applications?: unknown[];
    userData?: Record<string, unknown>;
    dependencies?: Record<string, unknown>;
};

describe('ModulePackageService', () => {
    let root: string;
    let apiRoot: string;
    let service: ModulePackageService;
    let commands: Array<{ command: string; args: string[]; cwd?: string; moduleFileAtCall?: string | null }>;
    let failInstall: boolean;
    let cwdSpy: jest.SpyInstance;
    let previousRuntimeDir: string | undefined;

    const realCommands = new CommandService();
    const modulePath = (relative: string) => path.join(apiRoot, 'src', MODULE, relative);
    const uiPath = (relative: string) => path.join(root, 'solid-ui', 'src', MODULE, relative);
    const read = (target: string) => fs.readFile(target, 'utf-8');
    const exists = (target: string) => fs.access(target).then(() => true, () => false);
    const metadata = async () => JSON.parse(await read(modulePath('metadata/test-hub-metadata.json')));

    // Builds a .sldx the way an exporter would: files, then a manifest carrying their checksums.
    async function buildPackage(spec: PackageSpec): Promise<string> {
        const files: Record<string, string> = {
            [`${API}/${MODULE}.module.ts`]: 'module',
            [`${UI}/${MODULE}.ui-module.ts`]: 'ui-module',
            [METADATA]: JSON.stringify({
                moduleMetadata: { name: MODULE, displayName: 'Test Hub' },
                testHubApplications: spec.applications ?? [],
                modulePackage: { userData: spec.userData ?? USER_DATA, ...(spec.dependencies ? { packageDependencies: spec.dependencies } : {}) },
            }),
        };
        for (const [relative, content] of Object.entries(spec.files)) {
            files[relative.startsWith('ui:') ? `${UI}/${relative.slice(3)}` : `${API}/${relative}`] = content;
        }

        const checksums = Object.fromEntries(Object.entries(files).map(([entry, content]) => [entry, createHash('sha256').update(content).digest('hex')]));
        const manifest = {
            schemaVersion: '1.1',
            packageType: 'solidx-module',
            exportedAt: new Date().toISOString(),
            generatedBy: { name: 'test' },
            module: { name: MODULE, version: spec.version, displayName: 'Test Hub' },
            contents: { metadataPath: METADATA, apiModulePath: `${API}/${MODULE}.module.ts`, uiModulePath: `${UI}/${MODULE}.ui-module.ts` },
            userData: { solidApiPaths: [], solidUiPaths: [], metadataKeys: [], ...(spec.userData ?? USER_DATA) },
            ...(spec.dependencies ? { dependencies: { solidUi: {}, prerequisites: [], ...spec.dependencies } } : {}),
            checksums,
        };

        const archivePath = path.join(root, 'packages', `${MODULE}-v${spec.version}-${Math.random().toString(36).slice(2)}.sldx`);
        await fs.mkdir(path.dirname(archivePath), { recursive: true });
        await new Promise<void>((resolve, reject) => {
            const output = createWriteStream(archivePath);
            const archive = archiver('zip');
            output.on('close', () => resolve());
            archive.on('error', reject);
            archive.pipe(output);
            for (const [entry, content] of Object.entries(files)) {
                archive.append(content, { name: entry });
            }
            archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
            void archive.finalize();
        });
        return archivePath;
    }

    const upload = async (spec: PackageSpec) => {
        const archivePath = await buildPackage(spec);
        return service.validateUpload({ path: archivePath, originalname: path.basename(archivePath) } as Express.Multer.File);
    };

    // Uploads and confirms a package. Returns the transaction key.
    const importPackage = async (spec: PackageSpec, dto: Record<string, unknown> = {}) => {
        const preview = await upload(spec);
        await service.confirmImport(preview.transactionKey, { confirmedVersion: spec.version, ...dto });
        return preview.transactionKey;
    };

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'module-package-service-'));
        apiRoot = path.join(root, 'solid-api');
        await fs.mkdir(apiRoot, { recursive: true });
        await fs.mkdir(path.join(root, 'solid-ui'), { recursive: true });

        previousRuntimeDir = process.env.SOLIDX_MODULE_PACKAGE_RUNTIME_DIR;
        process.env.SOLIDX_MODULE_PACKAGE_RUNTIME_DIR = path.join(root, 'runtime');
        cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(apiRoot);

        commands = [];
        failInstall = false;
        // unzip is real; package-manager commands are recorded instead of run.
        const commandService = {
            executeCommandWithArgs: async (input: { command: string; args: string[]; cwd?: string }) => {
                if (input.command === 'unzip') {
                    return realCommands.executeCommandWithArgs(input);
                }
                commands.push({ ...input, moduleFileAtCall: (await exists(modulePath(`${MODULE}.module.ts`))) ? await read(modulePath(`${MODULE}.module.ts`)) : null });
                if (failInstall) {
                    throw new Error('registry unreachable');
                }
                return 'ok';
            },
        } as unknown as CommandService;
        const helper = {
            getModuleMetadataFilePath: async (name: string) => path.join(apiRoot, 'src', name, 'metadata', `${name}-metadata.json`),
        };
        service = new ModulePackageService(commandService, helper as any, {} as any);
    });

    afterEach(async () => {
        cwdSpy.mockRestore();
        if (previousRuntimeDir === undefined) {
            delete process.env.SOLIDX_MODULE_PACKAGE_RUNTIME_DIR;
        } else {
            process.env.SOLIDX_MODULE_PACKAGE_RUNTIME_DIR = previousRuntimeDir;
        }
        await fs.rm(root, { recursive: true, force: true });
    });

    describe('update', () => {
        beforeEach(async () => {
            await importPackage({ version: '1.0.0', files: { 'old.ts': 'old', 'a.ts': 'a1', 'ui:screen.tsx': 's1' } });
            // What a user does with the installed module.
            await fs.mkdir(modulePath('metadata/test-scenarios'), { recursive: true });
            await fs.writeFile(modulePath('metadata/test-scenarios/mine.json'), '{"mine":true}');
            await fs.mkdir(modulePath('custom'), { recursive: true });
            await fs.writeFile(modulePath('custom/extra.ts'), 'custom');
            await fs.writeFile(
                modulePath('metadata/test-hub-metadata.json'),
                JSON.stringify({ ...(await metadata()), testHubApplications: [{ name: 'mine' }] }),
            );
        });

        it('shows only what the package changes and keeps the user\'s own files out of "removed"', async () => {
            const preview = await upload({ version: '2.0.0', files: { 'a.ts': 'a2' } });

            const { changeSet, fileSync, identicalContent } = preview.preview;
            expect(preview.status).toBe('awaiting_confirmation');
            expect(changeSet.solidApi.removed).toEqual(['old.ts']);
            expect(changeSet.solidApi.modified).toEqual(['a.ts']);
            expect(changeSet.solidUi.removed).toEqual(['screen.tsx']);
            expect(JSON.stringify(changeSet)).not.toContain('extra.ts');
            expect(JSON.stringify(changeSet)).not.toContain('mine.json');
            expect(fileSync.keptOtherFiles).toEqual([`${API}/custom/extra.ts`]);
            expect(fileSync.keptUserFiles).toBe(1);
            expect(identicalContent).toBe(false);
        });

        it('is not "identical" because of files the user added', async () => {
            const preview = await upload({ version: '1.0.0', files: { 'old.ts': 'old', 'a.ts': 'a1', 'ui:screen.tsx': 's1' } });
            expect(preview.preview.identicalContent).toBe(true);
        });

        it('updates package files, removes ones dropped upstream, and keeps scenarios, applications and own files', async () => {
            await importPackage({ version: '2.0.0', files: { 'a.ts': 'a2' } });

            expect(await read(modulePath('a.ts'))).toBe('a2');
            expect(await exists(modulePath('old.ts'))).toBe(false);
            expect(await exists(uiPath('screen.tsx'))).toBe(false);
            expect(await read(modulePath('metadata/test-scenarios/mine.json'))).toBe('{"mine":true}');
            expect(await read(modulePath('custom/extra.ts'))).toBe('custom');

            const installed = await metadata();
            expect(installed.testHubApplications).toEqual([{ name: 'mine' }]);
            expect(installed.moduleMetadata.version).toBe('2.0.0');
            const record = JSON.parse(await read(modulePath('.sldx-installed.json')));
            expect(record.version).toBe('2.0.0');
            expect(Object.keys(record.files)).not.toContain(`${API}/old.ts`);
        });

        it('ignores a package file under a user-data path', async () => {
            await importPackage({ version: '2.0.0', files: { 'metadata/test-scenarios/mine.json': 'developers' } });
            expect(await read(modulePath('metadata/test-scenarios/mine.json'))).toBe('{"mine":true}');
        });

        it('refuses to update when the installed metadata can\'t be read, and changes nothing', async () => {
            await fs.writeFile(modulePath('metadata/test-hub-metadata.json'), '{ not json');

            const preview = await upload({ version: '2.0.0', files: { 'a.ts': 'a2' } });

            expect(preview.status).toBe('failed');
            expect(preview.errorMessage).toContain("can't be read");
            expect(await read(modulePath('a.ts'))).toBe('a1');
        });

        it('also refuses at confirm if the file broke after the preview', async () => {
            const preview = await upload({ version: '2.0.0', files: { 'a.ts': 'a2' } });
            await fs.writeFile(modulePath('metadata/test-hub-metadata.json'), '{ not json');

            await expect(service.confirmImport(preview.transactionKey, { confirmedVersion: '2.0.0' })).rejects.toThrow(BadRequestException);

            expect(await read(modulePath('a.ts'))).toBe('a1');
            expect(await exists(modulePath('old.ts'))).toBe(true);
            expect(await read(modulePath('metadata/test-hub-metadata.json'))).toBe('{ not json');
        });

        it('restores the previous version but keeps what the user created after the update', async () => {
            const transactionKey = await importPackage({ version: '2.0.0', files: { 'a.ts': 'a2', 'new.ts': 'new' } });
            await fs.writeFile(modulePath('metadata/test-scenarios/after.json'), '{}');
            await fs.writeFile(
                modulePath('metadata/test-hub-metadata.json'),
                JSON.stringify({ ...(await metadata()), testHubApplications: [{ name: 'mine' }, { name: 'after' }] }),
            );

            await service.restoreBackup(transactionKey);

            expect(await read(modulePath('a.ts'))).toBe('a1');
            expect(await read(modulePath('old.ts'))).toBe('old');
            expect(await exists(modulePath('new.ts'))).toBe(false);
            expect(await read(uiPath('screen.tsx'))).toBe('s1');
            expect(await exists(modulePath('metadata/test-scenarios/after.json'))).toBe(true);
            expect(await read(modulePath('custom/extra.ts'))).toBe('custom');

            const restored = await metadata();
            expect(restored.testHubApplications).toEqual([{ name: 'mine' }, { name: 'after' }]);
            expect(restored.moduleMetadata.version).toBe('1.0.0');
            const record = JSON.parse(await read(modulePath('.sldx-installed.json')));
            expect(record.version).toBe('1.0.0');
            expect(Object.keys(record.files)).toContain(`${API}/old.ts`);
        });

        it('deletes nothing for a legacy install that has no install record', async () => {
            await fs.rm(modulePath('.sldx-installed.json'));
            await fs.writeFile(modulePath('stale.ts'), 'stale');

            const preview = await upload({ version: '2.0.0', files: { 'a.ts': 'a2' } });
            expect(preview.preview.fileSync.legacyInstall).toBe(true);
            await service.confirmImport(preview.transactionKey, { confirmedVersion: '2.0.0' });

            expect(await read(modulePath('a.ts'))).toBe('a2');
            expect(await read(modulePath('old.ts'))).toBe('old');
            expect(await read(modulePath('stale.ts'))).toBe('stale');
            expect(await exists(modulePath('.sldx-installed.json'))).toBe(true);
        });
    });

    describe('package dependencies', () => {
        const dependencies = { solidApi: { webdriverio: '^10.0.1', '@nestjs/schedule': '^4.1.2' }, prerequisites: [{ name: 'Appium', version: '3.8.0' }] };

        beforeEach(async () => {
            await fs.writeFile(path.join(apiRoot, 'package.json'), '{}');
            await fs.mkdir(path.join(apiRoot, 'node_modules', 'webdriverio'), { recursive: true });
            await fs.writeFile(path.join(apiRoot, 'node_modules', 'webdriverio', 'package.json'), '{"version":"10.1.0"}');
        });

        it('lists what will be installed and what is needed on the machine', async () => {
            const preview = await upload({ version: '1.0.0', files: {}, dependencies });

            expect(preview.preview.dependencies.solidApi.map((entry: any) => [entry.name, entry.state])).toEqual([
                ['webdriverio', 'present'],
                ['@nestjs/schedule', 'missing'],
            ]);
            const warnings = preview.validation.warnings.join('\n');
            expect(warnings).toContain('@nestjs/schedule@^4.1.2');
            expect(warnings).toContain('Appium 3.8.0');
            expect(warnings).not.toContain('webdriverio@');
        });

        it('warns about a package that is installed outside the declared range, and leaves it alone', async () => {
            await fs.writeFile(path.join(apiRoot, 'node_modules', 'webdriverio', 'package.json'), '{"version":"9.0.0"}');
            await fs.mkdir(path.join(apiRoot, 'node_modules', '@nestjs', 'schedule'), { recursive: true });
            await fs.writeFile(path.join(apiRoot, 'node_modules', '@nestjs', 'schedule', 'package.json'), '{"version":"4.1.2"}');

            const preview = await upload({ version: '1.0.0', files: {}, dependencies });

            expect(preview.validation.warnings.join('\n')).toContain('webdriverio 9.0.0 is installed but this module needs ^10.0.1');
            await service.confirmImport(preview.transactionKey, { confirmedVersion: '1.0.0' });
            expect(commands).toEqual([]);
        });

        it('installs only the missing packages, before any module file is placed', async () => {
            await importPackage({ version: '1.0.0', files: {}, dependencies });

            expect(commands).toHaveLength(1);
            expect(commands[0]).toMatchObject({
                command: 'npm',
                args: ['install', '--save', '--no-audit', '--no-fund', '@nestjs/schedule@^4.1.2'],
                cwd: apiRoot,
                moduleFileAtCall: null,
            });
            expect(await exists(modulePath(`${MODULE}.module.ts`))).toBe(true);
        });

        it('imports nothing when the install fails, and can be retried', async () => {
            failInstall = true;
            const preview = await upload({ version: '1.0.0', files: {}, dependencies });

            await expect(service.confirmImport(preview.transactionKey, { confirmedVersion: '1.0.0' })).rejects.toThrow(/Nothing was imported/);
            expect(await exists(modulePath(`${MODULE}.module.ts`))).toBe(false);

            failInstall = false;
            await service.confirmImport(preview.transactionKey, { confirmedVersion: '1.0.0' });
            expect(await exists(modulePath(`${MODULE}.module.ts`))).toBe(true);
        });

        it('skips the install when asked, and says what to run', async () => {
            failInstall = true;
            const preview = await upload({ version: '1.0.0', files: {}, dependencies });

            const result = await service.confirmImport(preview.transactionKey, { confirmedVersion: '1.0.0', skipDependencyInstall: true });

            expect(commands).toEqual([]);
            expect(await exists(modulePath(`${MODULE}.module.ts`))).toBe(true);
            expect(JSON.stringify(result)).toContain('npm install --save --no-audit --no-fund @nestjs/schedule@^4.1.2');
        });

        it('puts package.json back on restore and settles node_modules with the app\'s package manager', async () => {
            await fs.writeFile(path.join(apiRoot, 'pnpm-lock.yaml'), '');
            await importPackage({ version: '1.0.0', files: { 'a.ts': 'a1' } });

            const preview = await upload({ version: '2.0.0', files: { 'a.ts': 'a2' }, dependencies });
            await service.confirmImport(preview.transactionKey, { confirmedVersion: '2.0.0' });
            // Installing the missing package is what changes package.json.
            await fs.writeFile(path.join(apiRoot, 'package.json'), '{"dependencies":{"@nestjs/schedule":"^4.1.2"}}');
            commands.length = 0;

            await service.restoreBackup(preview.transactionKey);

            expect(await read(path.join(apiRoot, 'package.json'))).toBe('{}');
            expect(commands).toEqual([expect.objectContaining({ command: 'pnpm', args: ['install'], cwd: apiRoot })]);
        });
    });

    describe('export', () => {
        beforeEach(async () => {
            await importPackage({ version: '1.0.0', files: { 'a.ts': 'a1' }, applications: [{ name: 'developers app' }] });
            await fs.writeFile(
                modulePath('metadata/test-hub-metadata.json'),
                JSON.stringify({ ...(await metadata()), testHubApplications: [{ name: 'developers app' }] }),
            );
            await fs.mkdir(modulePath('metadata/test-scenarios'), { recursive: true });
            await fs.writeFile(modulePath('metadata/test-scenarios/mine.json'), '{}');
        });

        it('leaves user data and the install record out of the package', async () => {
            const result = await service.exportModulePackage(MODULE, {});

            const entries = execFileSync('unzip', ['-Z1', result.filePath], { encoding: 'utf-8' });
            expect(entries).not.toContain('test-scenarios');
            expect(entries).not.toContain('.sldx-installed.json');
            expect(entries).toContain(`${API}/a.ts`);

            const manifest = JSON.parse(execFileSync('unzip', ['-p', result.filePath, 'manifest.json'], { encoding: 'utf-8' }));
            expect(manifest.schemaVersion).toBe('1.1');
            expect(manifest.userData.metadataKeys).toEqual(['testHubApplications']);

            const packaged = JSON.parse(execFileSync('unzip', ['-p', result.filePath, METADATA], { encoding: 'utf-8' }));
            expect(packaged.testHubApplications).toEqual([]);
            // The project's own file is untouched.
            expect((await metadata()).testHubApplications).toEqual([{ name: 'developers app' }]);
        });

        it('refuses a declaration that lists the module definition as user data', async () => {
            await fs.writeFile(
                modulePath('metadata/test-hub-metadata.json'),
                JSON.stringify({ ...(await metadata()), modulePackage: { userData: { metadataKeys: ['moduleMetadata'] } } }),
            );

            await expect(service.exportModulePackage(MODULE, {})).rejects.toThrow('cannot list moduleMetadata');
        });
    });
});
