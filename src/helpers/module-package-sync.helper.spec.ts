import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
    applyModuleSync,
    buildInstallAllCommand,
    buildInstallCommand,
    buildInstallRecord,
    checkDependencies,
    findReservedMetadataKeys,
    INSTALL_RECORD_FILE,
    isProtectedPackagePath,
    listPackageFiles,
    mergeProtectedMetadataKeys,
    normalizePackageDependencies,
    normalizeUserData,
    planModuleSync,
    readInstallRecord,
    withEmptiedMetadataKeys,
    writeInstallRecord,
} from './module-package-sync.helper';

const MODULE = 'test-hub';
const METADATA = `solid-api/src/${MODULE}/metadata/${MODULE}-metadata.json`;
const userData = normalizeUserData({ solidApiPaths: ['metadata/test-scenarios'], metadataKeys: ['testHubApplications'] });

describe('module package sync', () => {
    let root: string;
    let apiDir: string;
    let uiDir: string;
    let extract: string;

    const write = async (base: string, relative: string, content: string) => {
        await fs.mkdir(path.dirname(path.join(base, relative)), { recursive: true });
        await fs.writeFile(path.join(base, relative), content);
    };
    const read = (base: string, relative: string) => fs.readFile(path.join(base, relative), 'utf-8');
    const exists = (base: string, relative: string) => fs.access(path.join(base, relative)).then(() => true, () => false);

    // Installs a package made of the given api files into the project, like an import does.
    const importPackage = async (files: Record<string, string>, version: string, data = userData) => {
        await fs.rm(extract, { recursive: true, force: true });
        const incomingApi = path.join(extract, 'solid-api', 'src', MODULE);
        for (const [relative, content] of Object.entries(files)) {
            await write(incomingApi, relative, content);
        }
        await fs.mkdir(path.join(extract, 'solid-ui', 'src', MODULE), { recursive: true });
        const previous = await readInstallRecord(apiDir);
        const plan = await planModuleSync({
            moduleName: MODULE,
            incoming: { ...(await listPackageFiles(`solid-api/src/${MODULE}`, incomingApi)), ...(await listPackageFiles(`solid-ui/src/${MODULE}`, path.join(extract, 'solid-ui', 'src', MODULE))) },
            current: { ...(await listPackageFiles(`solid-api/src/${MODULE}`, apiDir)), ...(await listPackageFiles(`solid-ui/src/${MODULE}`, uiDir)) },
            record: previous,
            userData: data,
            metadataPackagePath: METADATA,
        });
        await fs.mkdir(apiDir, { recursive: true });
        await fs.mkdir(uiDir, { recursive: true });
        await applyModuleSync(plan, MODULE, apiDir, uiDir);
        await writeInstallRecord(apiDir, buildInstallRecord(plan, previous, version));
        return plan;
    };

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'module-package-sync-'));
        apiDir = path.join(root, 'solid-api', 'src', MODULE);
        uiDir = path.join(root, 'solid-ui', 'src', MODULE);
        extract = path.join(root, 'extract');
    });

    afterEach(async () => {
        await fs.rm(root, { recursive: true, force: true });
    });

    it('installs a package and records what it installed', async () => {
        await importPackage({ 'a.ts': 'a1', 'metadata/test-hub-metadata.json': '{}' }, '1.0.0');

        expect(await read(apiDir, 'a.ts')).toBe('a1');
        const record = await readInstallRecord(apiDir);
        expect(record?.version).toBe('1.0.0');
        expect(Object.keys(record!.files)).toEqual([METADATA, `solid-api/src/${MODULE}/a.ts`].sort());
        expect(await exists(apiDir, INSTALL_RECORD_FILE)).toBe(true);
    });

    it('keeps user data and files added by hand across an update', async () => {
        await importPackage({ 'a.ts': 'a1', 'metadata/test-hub-metadata.json': '{}' }, '1.0.0');
        await write(apiDir, 'metadata/test-scenarios/mine.json', '{"mine":true}');
        await write(apiDir, 'custom/extra.service.ts', 'custom');

        const plan = await importPackage({ 'a.ts': 'a2', 'metadata/test-hub-metadata.json': '{"v":2}' }, '1.1.0');

        expect(await read(apiDir, 'a.ts')).toBe('a2');
        expect(await read(apiDir, 'metadata/test-scenarios/mine.json')).toBe('{"mine":true}');
        expect(await read(apiDir, 'custom/extra.service.ts')).toBe('custom');
        expect(plan.keptUserFiles).toEqual([`solid-api/src/${MODULE}/metadata/test-scenarios/mine.json`]);
        expect(plan.keptOther).toEqual([`solid-api/src/${MODULE}/custom/extra.service.ts`]);
    });

    it('drops a package file that sits under a user-data path', async () => {
        await write(apiDir, 'metadata/test-scenarios/mine.json', 'users');
        const plan = await importPackage({ 'a.ts': 'a1', 'metadata/test-hub-metadata.json': '{}', 'metadata/test-scenarios/mine.json': 'developers' }, '1.0.0');

        expect(await read(apiDir, 'metadata/test-scenarios/mine.json')).toBe('users');
        expect(plan.droppedProtected).toEqual([`solid-api/src/${MODULE}/metadata/test-scenarios/mine.json`]);
    });

    it('deletes a file removed upstream when it is unchanged, and keeps it when it was modified locally', async () => {
        await importPackage({ 'a.ts': 'a1', 'old.ts': 'old', 'edited.ts': 'orig', 'metadata/test-hub-metadata.json': '{}' }, '1.0.0');
        await write(apiDir, 'edited.ts', 'edited by user');

        const plan = await importPackage({ 'a.ts': 'a1', 'metadata/test-hub-metadata.json': '{}' }, '1.1.0');

        expect(await exists(apiDir, 'old.ts')).toBe(false);
        expect(await read(apiDir, 'edited.ts')).toBe('edited by user');
        expect(plan.remove).toEqual([`solid-api/src/${MODULE}/old.ts`]);
        expect(plan.keptModified).toEqual([`solid-api/src/${MODULE}/edited.ts`]);
        // Still recognised as the package's file, so it can be deleted later if the user reverts it.
        expect((await readInstallRecord(apiDir))?.files[`solid-api/src/${MODULE}/edited.ts`]).toBeDefined();
    });

    it('flags a package file that was modified locally and will be replaced', async () => {
        await importPackage({ 'a.ts': 'a1', 'metadata/test-hub-metadata.json': '{}' }, '1.0.0');
        await write(apiDir, 'a.ts', 'local edit');

        const plan = await importPackage({ 'a.ts': 'a2', 'metadata/test-hub-metadata.json': '{}' }, '1.1.0');

        expect(plan.replacedModified).toEqual([`solid-api/src/${MODULE}/a.ts`]);
        expect(await read(apiDir, 'a.ts')).toBe('a2');
    });

    it('does not flag the metadata file, which is rewritten on every install', async () => {
        await importPackage({ 'metadata/test-hub-metadata.json': '{}' }, '1.0.0');
        await write(apiDir, 'metadata/test-hub-metadata.json', '{"version":"1.0.0"}');

        const plan = await importPackage({ 'metadata/test-hub-metadata.json': '{"n":2}' }, '1.1.0');
        expect(plan.replacedModified).toEqual([]);
    });

    it('deletes nothing for a legacy install without a record, then creates one', async () => {
        await write(apiDir, 'stale.ts', 'stale');
        await write(apiDir, 'a.ts', 'a0');

        const plan = await importPackage({ 'a.ts': 'a1', 'metadata/test-hub-metadata.json': '{}' }, '1.0.0');

        expect(plan.legacyInstall).toBe(true);
        expect(plan.remove).toEqual([]);
        expect(await exists(apiDir, 'stale.ts')).toBe(true);
        expect(await readInstallRecord(apiDir)).not.toBeNull();
    });

    it('removes folders left empty by a deleted file but stops at the module root', async () => {
        await importPackage({ 'deep/inner/gone.ts': 'x', 'a.ts': 'a', 'metadata/test-hub-metadata.json': '{}' }, '1.0.0');
        await importPackage({ 'a.ts': 'a', 'metadata/test-hub-metadata.json': '{}' }, '1.1.0');

        expect(await exists(apiDir, 'deep')).toBe(false);
        expect(await exists(apiDir, 'a.ts')).toBe(true);
    });

    it('lists neither the install record nor macOS noise as package files', async () => {
        await write(apiDir, 'a.ts', 'a');
        await write(apiDir, INSTALL_RECORD_FILE, '{}');
        await write(apiDir, '.DS_Store', 'x');
        await write(apiDir, '._a.ts', 'x');

        expect(Object.keys(await listPackageFiles(`solid-api/src/${MODULE}`, apiDir))).toEqual([`solid-api/src/${MODULE}/a.ts`]);
        expect(await listPackageFiles('p', path.join(root, 'missing'))).toEqual({});
    });

    describe('user data', () => {
        it('normalises declared paths and rejects ones that leave the module', () => {
            expect(normalizeUserData({ solidApiPaths: ['./metadata/test-scenarios/', '../outside', '/abs', 'ok\\win'], metadataKeys: ['k', 3] })).toEqual({
                solidApiPaths: ['metadata/test-scenarios', 'ok/win'],
                solidUiPaths: [],
                metadataKeys: ['k'],
            });
            expect(normalizeUserData(undefined)).toEqual({ solidApiPaths: [], solidUiPaths: [], metadataKeys: [] });
        });

        it('never treats the module definition as user data', () => {
            const declared = { metadataKeys: ['testHubApplications', 'moduleMetadata', 'modulePackage'] };
            expect(normalizeUserData(declared).metadataKeys).toEqual(['testHubApplications']);
            expect(findReservedMetadataKeys(declared)).toEqual(['moduleMetadata', 'modulePackage']);
            expect(findReservedMetadataKeys({ metadataKeys: ['testHubApplications'] })).toEqual([]);
            expect(findReservedMetadataKeys(undefined)).toEqual([]);
        });

        it('matches a path only at a folder boundary', () => {
            expect(isProtectedPackagePath(`solid-api/src/${MODULE}/metadata/test-scenarios/a.json`, MODULE, userData)).toBe(true);
            expect(isProtectedPackagePath(`solid-api/src/${MODULE}/metadata/test-scenarios-extra/a.json`, MODULE, userData)).toBe(false);
            expect(isProtectedPackagePath(`solid-ui/src/${MODULE}/metadata/test-scenarios/a.json`, MODULE, userData)).toBe(false);
        });

        it('keeps the installed value of each protected metadata key', () => {
            const incoming = { moduleMetadata: { name: MODULE }, testHubApplications: [], other: 'new' };
            const installed = { testHubApplications: [{ name: 'mine' }], other: 'old' };
            expect(mergeProtectedMetadataKeys(incoming, installed, ['testHubApplications'])).toEqual({
                moduleMetadata: { name: MODULE },
                testHubApplications: [{ name: 'mine' }],
                other: 'new',
            });
            expect(mergeProtectedMetadataKeys(incoming, null, ['testHubApplications'])).toBe(incoming);
        });

        it('empties protected keys for export', () => {
            expect(withEmptiedMetadataKeys({ a: [1], b: { x: 1 }, c: 'keep' }, ['a', 'b', 'missing'])).toEqual({ a: [], b: {}, c: 'keep' });
        });
    });

    describe('package dependencies', () => {
        it('ignores an empty declaration and sanitises a real one', () => {
            expect(normalizePackageDependencies(undefined)).toBeNull();
            expect(normalizePackageDependencies({ solidApi: {}, solidUi: {}, prerequisites: [] })).toBeNull();
            expect(normalizePackageDependencies({ solidApi: { webdriverio: '^10.0.1', bad: 1 }, prerequisites: [{ name: 'Java' }, 'x'] })).toEqual({
                solidApi: { webdriverio: '^10.0.1' },
                solidUi: {},
                prerequisites: [{ name: 'Java' }],
            });
        });

        it('marks packages missing, present or mismatched against node_modules', async () => {
            await write(root, 'node_modules/webdriverio/package.json', '{"version":"10.2.0"}');
            await write(root, 'node_modules/@nestjs/schedule/package.json', '{"version":"3.0.0"}');

            const statuses = await checkDependencies(root, { webdriverio: '^10.0.1', '@nestjs/schedule': '^4.1.2', 'not-there': '^1.0.0' });

            expect(statuses.map((status) => [status.name, status.state])).toEqual([
                ['webdriverio', 'present'],
                ['@nestjs/schedule', 'mismatch'],
                ['not-there', 'missing'],
            ]);
            expect(statuses[1].installedVersion).toBe('3.0.0');
        });

        it('picks the package manager from the lock file', async () => {
            expect((await buildInstallCommand(root, ['a@^1'])).command).toBe('npm');
            expect((await buildInstallCommand(root, ['a@^1'])).args).toEqual(['install', '--save', '--no-audit', '--no-fund', 'a@^1']);

            await write(root, 'yarn.lock', '');
            expect(await buildInstallCommand(root, ['a@^1'])).toEqual({ command: 'yarn', args: ['add', 'a@^1'] });

            await write(root, 'pnpm-lock.yaml', '');
            expect(await buildInstallCommand(root, ['a@^1'])).toEqual({ command: 'pnpm', args: ['add', 'a@^1'] });
        });

        it('installs everything with the same package manager', async () => {
            expect(await buildInstallAllCommand(root)).toEqual({ command: 'npm', args: ['install', '--no-audit', '--no-fund'] });
            await write(root, 'yarn.lock', '');
            expect(await buildInstallAllCommand(root)).toEqual({ command: 'yarn', args: ['install'] });
            await write(root, 'pnpm-lock.yaml', '');
            expect(await buildInstallAllCommand(root)).toEqual({ command: 'pnpm', args: ['install'] });
        });
    });
});
