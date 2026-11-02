import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as semver from 'semver';

/**
 * File-level rules for installing, updating and restoring a module package.
 *
 * An update only touches files a package installed. What a package installed is recorded in
 * INSTALL_RECORD_FILE (inside the module's solid-api folder); files the user added, and anything
 * the module declares as user data, are never written or deleted.
 */
export const INSTALL_RECORD_FILE = '.sldx-installed.json';

export type ModulePackageUserData = {
    solidApiPaths: string[];
    solidUiPaths: string[];
    metadataKeys: string[];
};

export type InstallRecord = {
    version: string | null;
    // Package path (solid-api/src/<m>/..., solid-ui/src/<m>/...) -> sha256 of the file as installed.
    files: Record<string, string>;
};

export type SyncPlan = {
    // Package paths to write, with the absolute source file.
    write: Array<{ packagePath: string; source: string; checksum: string }>;
    // Package paths to delete: installed by an earlier package, gone from this one, unchanged locally.
    remove: string[];
    // Installed by an earlier package, gone from this one, but modified locally: kept.
    keptModified: string[];
    // Written by this package over a file that was modified locally since it was installed.
    replacedModified: string[];
    // Files neither package knows about (added by hand): never touched.
    keptOther: string[];
    // Files in the package under a user-data path: dropped.
    droppedProtected: string[];
    // Files under a user-data path in the installed module: never touched.
    keptUserFiles: string[];
    // No install record existed, so nothing is deleted.
    legacyInstall: boolean;
};

export type DependencyState = 'missing' | 'present' | 'mismatch';

export type DependencyStatus = {
    name: string;
    range: string;
    state: DependencyState;
    installedVersion: string | null;
};

export type PackageDependencies = {
    solidApi: Record<string, string>;
    solidUi: Record<string, string>;
    prerequisites: Array<Record<string, unknown>>;
};

export function emptyUserData(): ModulePackageUserData {
    return { solidApiPaths: [], solidUiPaths: [], metadataKeys: [] };
}

const toStringList = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map((entry) => entry.trim()) : [];

// Reads modulePackage.userData from a metadata document or a manifest-shaped object. Paths are cleaned
// to forward-slash form without leading "./" or trailing "/"; anything that tries to leave the module is dropped.
export function normalizeUserData(raw: any): ModulePackageUserData {
    const cleanPath = (entry: string) => entry.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
    const safe = (entries: string[]) => entries.map(cleanPath).filter((entry) => entry && !entry.startsWith('/') && !entry.split('/').includes('..'));
    return {
        solidApiPaths: safe(toStringList(raw?.solidApiPaths)),
        solidUiPaths: safe(toStringList(raw?.solidUiPaths)),
        metadataKeys: toStringList(raw?.metadataKeys),
    };
}

export function mergeUserData(...sources: ModulePackageUserData[]): ModulePackageUserData {
    const union = (pick: (data: ModulePackageUserData) => string[]) => Array.from(new Set(sources.flatMap(pick)));
    return {
        solidApiPaths: union((data) => data.solidApiPaths),
        solidUiPaths: union((data) => data.solidUiPaths),
        metadataKeys: union((data) => data.metadataKeys),
    };
}

export function hasUserData(userData: ModulePackageUserData): boolean {
    return userData.solidApiPaths.length + userData.solidUiPaths.length + userData.metadataKeys.length > 0;
}

// True when a package path (solid-api/src/<m>/metadata/test-scenarios/x.json) is under a declared user-data path.
export function isProtectedPackagePath(packagePath: string, moduleName: string, userData: ModulePackageUserData): boolean {
    const under = (root: string, paths: string[]) =>
        paths.some((entry) => packagePath === `${root}/${entry}` || packagePath.startsWith(`${root}/${entry}/`));
    return under(`solid-api/src/${moduleName}`, userData.solidApiPaths) || under(`solid-ui/src/${moduleName}`, userData.solidUiPaths);
}

export async function sha256File(filePath: string): Promise<string> {
    return createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
}

async function pathExists(target: string): Promise<boolean> {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

const isNoise = (relativePath: string) =>
    relativePath.split('/').some((segment) => segment === '__MACOSX' || segment.startsWith('._') || segment === '.DS_Store');

// Every file under dir, keyed by package path (prefix + relative path). Missing dir -> empty.
export async function listPackageFiles(prefix: string, dir: string | null): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    if (!dir || !(await pathExists(dir))) {
        return files;
    }

    const walk = async (current: string, relative: string) => {
        for (const entry of await fs.readdir(current, { withFileTypes: true })) {
            const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                await walk(path.join(current, entry.name), entryRelative);
            } else if (entry.isFile() && !isNoise(entryRelative) && entryRelative !== INSTALL_RECORD_FILE) {
                files[`${prefix}/${entryRelative}`] = path.join(current, entry.name);
            }
        }
    };
    await walk(dir, '');
    return files;
}

export async function readInstallRecord(apiModuleDir: string): Promise<InstallRecord | null> {
    try {
        const parsed = JSON.parse(await fs.readFile(path.join(apiModuleDir, INSTALL_RECORD_FILE), 'utf-8'));
        if (parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object') {
            return { version: parsed.version ?? null, files: parsed.files };
        }
    } catch {
        // No record, or an unreadable one: treated as a legacy install.
    }
    return null;
}

export async function writeInstallRecord(apiModuleDir: string, record: InstallRecord | null): Promise<void> {
    const target = path.join(apiModuleDir, INSTALL_RECORD_FILE);
    if (!record) {
        await fs.rm(target, { force: true });
        return;
    }
    await fs.mkdir(apiModuleDir, { recursive: true });
    const sorted = Object.fromEntries(Object.entries(record.files).sort(([left], [right]) => left.localeCompare(right)));
    await fs.writeFile(target, JSON.stringify({ version: record.version, files: sorted }, null, 2));
}

export type PlanOptions = {
    moduleName: string;
    // Package path -> absolute source file, for the side being installed (a package, or a backup on restore).
    incoming: Record<string, string>;
    // Package path -> absolute file, for what is on disk now.
    current: Record<string, string>;
    record: InstallRecord | null;
    userData: ModulePackageUserData;
    // The metadata file is rewritten on every install (version, merged keys), so it is never "locally modified".
    metadataPackagePath: string;
};

export async function planModuleSync(options: PlanOptions): Promise<SyncPlan> {
    const { moduleName, incoming, current, record, userData, metadataPackagePath } = options;
    const protectedPath = (packagePath: string) => isProtectedPackagePath(packagePath, moduleName, userData);
    const plan: SyncPlan = {
        write: [],
        remove: [],
        keptModified: [],
        replacedModified: [],
        keptOther: [],
        droppedProtected: [],
        keptUserFiles: [],
        legacyInstall: !record,
    };

    for (const [packagePath, source] of Object.entries(incoming).sort(([left], [right]) => left.localeCompare(right))) {
        if (protectedPath(packagePath)) {
            plan.droppedProtected.push(packagePath);
            continue;
        }

        const checksum = await sha256File(source);
        plan.write.push({ packagePath, source, checksum });

        const currentFile = current[packagePath];
        const installedChecksum = record?.files[packagePath];
        if (currentFile && installedChecksum && packagePath !== metadataPackagePath && (await sha256File(currentFile)) !== installedChecksum) {
            plan.replacedModified.push(packagePath);
        }
    }

    const incomingPaths = new Set(Object.keys(incoming));
    for (const [packagePath, installedChecksum] of Object.entries(record?.files ?? {}).sort(([left], [right]) => left.localeCompare(right))) {
        if (incomingPaths.has(packagePath) || protectedPath(packagePath)) {
            continue;
        }
        const currentFile = current[packagePath];
        if (!currentFile) {
            continue;
        }
        if ((await sha256File(currentFile)) === installedChecksum) {
            plan.remove.push(packagePath);
        } else {
            plan.keptModified.push(packagePath);
        }
    }

    for (const packagePath of Object.keys(current).sort()) {
        if (protectedPath(packagePath)) {
            plan.keptUserFiles.push(packagePath);
        } else if (!incomingPaths.has(packagePath) && !(record?.files && packagePath in record.files)) {
            plan.keptOther.push(packagePath);
        }
    }

    return plan;
}

// Maps a package path to its location in the project: solid-api/src/<m>/x -> <apiRoot>/x.
export function resolveTargetPath(packagePath: string, moduleName: string, apiModuleDir: string, uiModuleDir: string): string {
    const apiPrefix = `solid-api/src/${moduleName}/`;
    const uiPrefix = `solid-ui/src/${moduleName}/`;
    if (packagePath.startsWith(apiPrefix)) {
        return path.join(apiModuleDir, packagePath.slice(apiPrefix.length));
    }
    if (packagePath.startsWith(uiPrefix)) {
        return path.join(uiModuleDir, packagePath.slice(uiPrefix.length));
    }
    throw new Error(`Unexpected package path: ${packagePath}`);
}

export async function applyModuleSync(plan: SyncPlan, moduleName: string, apiModuleDir: string, uiModuleDir: string): Promise<void> {
    for (const packagePath of plan.remove) {
        const target = resolveTargetPath(packagePath, moduleName, apiModuleDir, uiModuleDir);
        await fs.rm(target, { force: true });
        // Tidy folders left empty, stopping at the module root.
        const root = packagePath.startsWith(`solid-api/src/${moduleName}/`) ? apiModuleDir : uiModuleDir;
        let folder = path.dirname(target);
        while (folder !== root && folder.startsWith(root)) {
            const remaining = await fs.readdir(folder).catch(() => ['x']);
            if (remaining.length > 0) {
                break;
            }
            await fs.rmdir(folder).catch(() => undefined);
            folder = path.dirname(folder);
        }
    }

    for (const { packagePath, source } of plan.write) {
        const target = resolveTargetPath(packagePath, moduleName, apiModuleDir, uiModuleDir);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(source, target);
    }
}

// What the install record should hold after a sync: everything written, plus what was kept from the old
// record because it was modified locally (so it is still recognised as the package's file next time).
export function buildInstallRecord(plan: SyncPlan, previous: InstallRecord | null, version: string | null): InstallRecord {
    const files: Record<string, string> = {};
    for (const { packagePath, checksum } of plan.write) {
        files[packagePath] = checksum;
    }
    for (const packagePath of plan.keptModified) {
        if (previous?.files[packagePath]) {
            files[packagePath] = previous.files[packagePath];
        }
    }
    return { version, files };
}

// The metadata document with each protected key taken from the installed document (when it has the key).
export function mergeProtectedMetadataKeys(incoming: any, installed: any, keys: string[]): any {
    if (!incoming || !installed || keys.length === 0) {
        return incoming;
    }
    const merged = { ...incoming };
    for (const key of keys) {
        if (key in installed) {
            merged[key] = installed[key];
        }
    }
    return merged;
}

// A copy of the document with each protected key emptied, used on export and when fingerprinting.
export function withEmptiedMetadataKeys(document: any, keys: string[]): any {
    if (!document || keys.length === 0) {
        return document;
    }
    const emptied = { ...document };
    for (const key of keys) {
        if (key in emptied) {
            emptied[key] = Array.isArray(emptied[key]) ? [] : emptied[key] && typeof emptied[key] === 'object' ? {} : null;
        }
    }
    return emptied;
}

export function normalizePackageDependencies(raw: any): PackageDependencies | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const toRanges = (value: any): Record<string, string> =>
        Object.fromEntries(
            Object.entries(value && typeof value === 'object' ? value : {}).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[0].trim().length > 0,
            ),
        );
    const dependencies: PackageDependencies = {
        solidApi: toRanges(raw.solidApi),
        solidUi: toRanges(raw.solidUi),
        prerequisites: Array.isArray(raw.prerequisites) ? raw.prerequisites.filter((entry: unknown) => entry && typeof entry === 'object') : [],
    };
    const empty = Object.keys(dependencies.solidApi).length + Object.keys(dependencies.solidUi).length + dependencies.prerequisites.length === 0;
    return empty ? null : dependencies;
}

// Compares each declared package with what node_modules holds in the given app folder.
export async function checkDependencies(appDir: string, declared: Record<string, string>): Promise<DependencyStatus[]> {
    const statuses: DependencyStatus[] = [];
    for (const [name, range] of Object.entries(declared)) {
        let installedVersion: string | null = null;
        try {
            const manifest = JSON.parse(await fs.readFile(path.join(appDir, 'node_modules', ...name.split('/'), 'package.json'), 'utf-8'));
            installedVersion = typeof manifest?.version === 'string' ? manifest.version : null;
        } catch {
            installedVersion = null;
        }

        let state: DependencyState = 'missing';
        if (installedVersion) {
            state = semver.validRange(range) && !semver.satisfies(installedVersion, range, { includePrerelease: true }) ? 'mismatch' : 'present';
        }
        statuses.push({ name, range, state, installedVersion });
    }
    return statuses;
}

export type InstallCommand = { command: string; args: string[] };

// The package manager follows the lock file the app already has; npm when there is none.
export async function buildInstallCommand(appDir: string, specs: string[]): Promise<InstallCommand> {
    if (await pathExists(path.join(appDir, 'pnpm-lock.yaml'))) {
        return { command: 'pnpm', args: ['add', ...specs] };
    }
    if (await pathExists(path.join(appDir, 'yarn.lock'))) {
        return { command: 'yarn', args: ['add', ...specs] };
    }
    return { command: 'npm', args: ['install', '--save', '--no-audit', '--no-fund', ...specs] };
}

export const PROJECT_FILES_TO_BACK_UP = ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
