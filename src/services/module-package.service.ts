import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import * as semver from 'semver';
import { DisallowInProduction } from 'src/decorators/disallow-in-production.decorator';
import { ConfirmModulePackageImportDto } from 'src/dtos/confirm-module-package-import.dto';
import { ExportModulePackageDto } from 'src/dtos/export-module-package.dto';
import { RunModulePackageBuildDto } from 'src/dtos/run-module-package-build.dto';
import { RunModulePackageSeedDto } from 'src/dtos/run-module-package-seed.dto';
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { CommandService } from 'src/helpers/command.service';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import {
    applyModuleSync,
    buildInstallAllCommand,
    buildInstallCommand,
    buildInstallRecord,
    checkDependencies,
    DependencyStatus,
    findReservedMetadataKeys,
    hasUserData,
    INSTALL_RECORD_FILE,
    isProtectedPackagePath,
    listPackageFiles,
    mergeProtectedMetadataKeys,
    mergeUserData,
    ModulePackageUserData,
    normalizePackageDependencies,
    normalizeUserData,
    PackageDependencies,
    planModuleSync,
    PROJECT_FILES_TO_BACK_UP,
    readInstallRecord,
    SyncPlan,
    withEmptiedMetadataKeys,
    writeInstallRecord,
} from 'src/helpers/module-package-sync.helper';
import { DataSource } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

type ModulePackageManifest = {
    schemaVersion: string;
    packageType: string;
    exportedAt?: string;
    generatedBy?: {
        name: string;
        version?: string;
    };
    module: {
        name: string;
        version?: string;
        displayName?: string;
        description?: string;
    };
    contents: {
        metadataPath: string;
        apiModulePath: string;
        uiModulePath: string;
    };
    compatibility?: Record<string, unknown>;
    // Paths and metadata keys that hold end-user data; an update never touches them. Mirrors modulePackage.userData.
    userData?: Partial<ModulePackageUserData>;
    // Packages the module needs in the host app. Mirrors modulePackage.packageDependencies.
    dependencies?: Partial<PackageDependencies>;
    postImport?: Record<string, unknown>;
    checksums?: Record<string, string>;
};

type ValidationPayload = {
    valid: boolean;
    errors: string[];
    warnings: string[];
};

type ModulePackageMode = 'install' | 'update';

// new: module not installed. first_version: installed module is unversioned, package is versioned.
// legacy_package: package is unversioned while the module is installed.
type ModulePackageVersionComparison = 'new' | 'upgrade' | 'same' | 'downgrade' | 'first_version' | 'legacy_package';

type ModulePackageFileDiff = {
    added: string[];
    modified: string[];
    removed: string[];
    unchangedCount: number;
};

type ModulePackageChangeSet = {
    solidApi: ModulePackageFileDiff;
    solidUi: ModulePackageFileDiff;
};

type ModulePackageBackup = {
    path: string;
    version: string | null;
    createdAt: string;
};

type PreviewPayload = {
    module: {
        name: string;
        version?: string;
        displayName?: string;
        description?: string;
    };
    mode: ModulePackageMode;
    installedVersion: string | null;
    incomingVersion: string | null;
    versionComparison: ModulePackageVersionComparison | null;
    requiresVersionAcknowledgement: boolean;
    identicalContent: boolean;
    contentFingerprint: string | null;
    changeSet: ModulePackageChangeSet | null;
    manifest: ModulePackageManifest;
    contentsSummary: {
        totalEntries: number;
        solidApiEntries: number;
        solidUiEntries: number;
    };
    requiredPaths: {
        metadataPath: string;
        apiModulePath: string;
        uiModulePath: string;
    };
    conflicts: string[];
    fileTree: string[];
    nextActions: string[];
    // Update mode: what the update will do to files (null on a fresh install).
    fileSync: ModulePackageFileSyncSummary | null;
    // Packages the module declares, checked against the host app (null when it declares none).
    dependencies: ModulePackageDependencyPreview | null;
};

type ModulePackageFileSyncSummary = {
    legacyInstall: boolean;
    keptUserFiles: number;
    keptOtherFiles: string[];
    removedUpstream: string[];
    keptModifiedFiles: string[];
    locallyModifiedReplaced: string[];
    droppedProtected: string[];
    protectedMetadataKeys: string[];
};

type ModulePackageDependencyPreview = {
    solidApi: DependencyStatus[];
    solidUi: DependencyStatus[];
    prerequisites: Array<Record<string, unknown>>;
    missingCount: number;
    mismatchCount: number;
    installCommands: string[];
};

type ParsedArchive = {
    entries: string[];
    archiveRootPrefix: string | null;
    manifest: ModulePackageManifest;
    metadataDocument: any;
    validation: ValidationPayload;
    preview: PreviewPayload;
};

type ModulePackageStatusFile = {
    transactionKey: string;
    status: string;
    currentStep: string;
    moduleName: string | null;
    moduleDisplayName: string | null;
    archiveFileName: string | null;
    archiveFilePath: string | null;
    extractDirPath: string | null;
    archiveRootPrefix: string | null;
    manifest: ModulePackageManifest | null;
    metadataDocument: any;
    preview: PreviewPayload | null;
    validation: ValidationPayload | null;
    conflicts: string[];
    mode: ModulePackageMode;
    installedVersion: string | null;
    incomingVersion: string | null;
    versionComparison: ModulePackageVersionComparison | null;
    backup: ModulePackageBackup | null;
    restoredFromBackup: boolean;
    outputs: {
        import: string | null;
        build: string | null;
        seed: string | null;
        restore: string | null;
    };
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
};

type ModulePackageExportFile = {
    fileName: string;
    filePath: string;
    mimeType: string;
};

type ModulePackageRuntimeCleanupResult = {
    runtimeRoot: string;
    removedImportTransactions: number;
    removedExportTransactions: number;
    removedImportLooseEntries: number;
    removedExportLooseEntries: number;
    removedBackups: number;
    clearedActiveTransactionPointer: boolean;
    clearedAt: string;
};

type InstalledModuleState = {
    installed: boolean;
    version: string | null;
};

type ModulePackageActiveTransactionFile = {
    transactionKey: string;
    updatedAt: string;
};

enum ModulePackageStatus {
    uploaded = 'uploaded',
    validated = 'validated',
    awaiting_confirmation = 'awaiting_confirmation',
    import_running = 'import_running',
    awaiting_restart = 'awaiting_restart',
    build_running = 'build_running',
    build_failed = 'build_failed',
    build_succeeded = 'build_succeeded',
    seed_running = 'seed_running',
    seed_failed = 'seed_failed',
    restore_running = 'restore_running',
    completed = 'completed',
    failed = 'failed',
}

@Injectable()
export class ModulePackageService {
    private readonly logger = new Logger(ModulePackageService.name);
    private static readonly SUPPORTED_SCHEMA_VERSION = '1.0';
    // 1.1 packages declare userData and/or dependencies; an older core refuses them rather than overwrite user data.
    private static readonly SUPPORTED_SCHEMA_VERSIONS = ['1.0', '1.1'];
    private static readonly SUPPORTED_PACKAGE_TYPE = 'solidx-module';
    private static readonly OVERWRITE_CONFIRMATION_WARNING = 'The target module already exists locally and will require overwrite confirmation.';
    private static readonly VERSION_ACKNOWLEDGEMENT_COMPARISONS: ModulePackageVersionComparison[] = ['same', 'downgrade', 'legacy_package'];

    constructor(
        private readonly commandService: CommandService,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) { }

    @DisallowInProduction()
    async validateUpload(file: Express.Multer.File, expectedModuleNameInput?: string) {
        if (!file) {
            throw new BadRequestException('A .sldx archive file is required.');
        }

        await this.cleanupModulePackageTransactions();

        const transactionKey = uuidv4();
        const workingDir = await this.createWorkingDir(transactionKey);
        const archiveFileName = file.originalname || path.basename(file.path);
        const archiveFilePath = path.join(workingDir, archiveFileName);
        const extractDirPath = path.join(workingDir, 'extract');

        await fs.mkdir(extractDirPath, { recursive: true });
        await fs.rename(file.path, archiveFilePath);

        const parsed = await this.parseArchive(archiveFilePath);
        await this.extractArchive(archiveFilePath, extractDirPath);
        await this.applyInstallStateToPreview(
            parsed,
            this.resolveExtractRoot(extractDirPath, parsed.archiveRootPrefix),
            (expectedModuleNameInput ?? '').trim() || null,
        );

        const transaction: ModulePackageStatusFile = {
            transactionKey,
            status: parsed.validation.valid ? ModulePackageStatus.awaiting_confirmation : ModulePackageStatus.failed,
            currentStep: 'preview',
            moduleName: parsed.manifest.module.name,
            moduleDisplayName: parsed.manifest.module.displayName ?? null,
            archiveFileName,
            archiveFilePath,
            extractDirPath,
            archiveRootPrefix: parsed.archiveRootPrefix,
            manifest: parsed.manifest,
            metadataDocument: parsed.metadataDocument,
            preview: parsed.preview,
            validation: parsed.validation,
            conflicts: parsed.preview.conflicts,
            mode: parsed.preview.mode,
            installedVersion: parsed.preview.installedVersion,
            incomingVersion: parsed.preview.incomingVersion,
            versionComparison: parsed.preview.versionComparison,
            backup: null,
            restoredFromBackup: false,
            outputs: {
                import: null,
                build: null,
                seed: null,
                restore: null,
            },
            errorMessage: parsed.validation.valid ? null : parsed.validation.errors.join('\n'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await this.writeStatusFile(transactionKey, transaction);
        return this.toStatusResponse(transaction);
    }

    async getStatus(transactionKey: string) {
        const transaction = await this.loadTransaction(transactionKey);
        return this.toStatusResponse(transaction);
    }

    @DisallowInProduction()
    async getLatestResumableImport() {
        await this.cleanupModulePackageTransactions();
        const transaction = await this.resolveLatestResumableTransaction();
        return transaction ? this.toStatusResponse(transaction) : null;
    }

    @DisallowInProduction()
    async dismissImport(transactionKey: string) {
        const transaction = await this.loadTransaction(transactionKey);
        await this.clearActiveTransactionIfMatches(transaction.transactionKey);
        return this.toStatusResponse(transaction);
    }

    @DisallowInProduction()
    async clearPackageRuntime(): Promise<ModulePackageRuntimeCleanupResult> {
        const runtimeRoot = this.getModulePackageRuntimeRoot();
        const importsRoot = this.getModulePackageImportsRoot();
        const exportsRoot = this.getModulePackageExportsRoot();
        const snapshot = await this.collectRuntimeCleanupSnapshot();

        await fs.rm(runtimeRoot, { recursive: true, force: true });
        await fs.mkdir(importsRoot, { recursive: true });
        await fs.mkdir(exportsRoot, { recursive: true });

        return {
            runtimeRoot,
            ...snapshot,
            clearedAt: new Date().toISOString(),
        };
    }

    @DisallowInProduction()
    async exportModulePackage(moduleNameInput: string, dto: ExportModulePackageDto = {}): Promise<ModulePackageExportFile> {
        const moduleName = (moduleNameInput ?? '').trim();
        if (!moduleName) {
            throw new BadRequestException('A module name is required to export a module package.');
        }

        const solidApiModulePath = this.getSolidApiModuleTargetPath(moduleName);
        const solidUiModulePath = this.getSolidUiModuleTargetPath(moduleName);
        const metadataFilePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);

        await this.assertPathExists(solidApiModulePath, 'solid-api module path');
        await this.assertPathExists(solidUiModulePath, 'solid-ui module path');
        await this.assertPathExists(metadataFilePath, 'module metadata file');

        let metadataDocument = this.parseMetadataDocument(
            await fs.readFile(metadataFilePath, 'utf-8'),
            [],
        );

        const reservedKeys = findReservedMetadataKeys(metadataDocument?.modulePackage?.userData);
        if (reservedKeys.length > 0) {
            throw new BadRequestException(
                `modulePackage.userData.metadataKeys cannot list ${reservedKeys.join(', ')}: the module's own definition always comes from the package.`,
            );
        }

        const currentVersion = this.toValidVersion(metadataDocument?.moduleMetadata?.version);
        const exportVersion = this.resolveExportVersion(currentVersion, dto);
        if (exportVersion !== currentVersion) {
            // The version is owned by the metadata file, so write it back before staging the package.
            metadataDocument = await this.writeModuleVersion(metadataFilePath, exportVersion);
            await this.syncModuleVersionInDb(moduleName, exportVersion);
        }

        const transactionKey = uuidv4();
        const exportRoot = path.join(this.getModulePackageExportsRoot(), transactionKey);
        const stagingDir = path.join(exportRoot, 'staging');
        const archiveFileName = exportVersion ? `${moduleName}-v${exportVersion}.sldx` : `${moduleName}.sldx`;
        const archiveFilePath = path.join(exportRoot, archiveFileName);

        await fs.mkdir(path.join(stagingDir, 'solid-api', 'src'), { recursive: true });
        await fs.mkdir(path.join(stagingDir, 'solid-ui', 'src'), { recursive: true });

        await fs.cp(solidApiModulePath, path.join(stagingDir, 'solid-api', 'src', moduleName), { recursive: true });
        await fs.cp(solidUiModulePath, path.join(stagingDir, 'solid-ui', 'src', moduleName), { recursive: true });
        await this.removeUserDataFromStaging(stagingDir, moduleName, metadataDocument);

        const manifest = await this.buildExportManifest(moduleName, metadataDocument, stagingDir);
        await fs.writeFile(
            path.join(stagingDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2),
            'utf-8',
        );

        await this.createArchiveFromDirectory(stagingDir, archiveFilePath);

        return {
            fileName: archiveFileName,
            filePath: archiveFilePath,
            mimeType: 'application/zip',
        };
    }

    @DisallowInProduction()
    async confirmImport(transactionKey: string, dto: ConfirmModulePackageImportDto = {}) {
        const transaction = await this.loadTransaction(transactionKey);
        const preview = transaction.preview;
        const validation = transaction.validation;

        if (!preview || !validation) {
            throw new BadRequestException('The module package transaction is missing preview or validation data.');
        }

        if (!validation.valid) {
            throw new BadRequestException({
                message: 'The uploaded module package is invalid and cannot be imported.',
                validation,
            });
        }

        const isUpdate = transaction.mode === 'update';
        if (isUpdate) {
            await this.assertUpdateApproved(transaction, dto);
        }

        const overwriteExisting = isUpdate || (dto.overwriteExisting ?? false);
        if (!isUpdate && preview.conflicts.length > 0 && !overwriteExisting) {
            throw new BadRequestException({
                message: 'Conflicts were detected. Re-submit with overwriteExisting=true to continue.',
                conflicts: preview.conflicts,
            });
        }

        transaction.status = ModulePackageStatus.import_running;
        transaction.currentStep = 'import';
        transaction.errorMessage = null;
        await this.writeStatusFile(transactionKey, transaction);

        try {
            const moduleName = preview.module.name;
            const solidApiTarget = this.getSolidApiModuleTargetPath(moduleName);
            const solidUiTarget = this.getSolidUiModuleTargetPath(moduleName);
            const extractRoot = this.resolveExtractRoot(transaction.extractDirPath as string, transaction.archiveRootPrefix);
            const solidApiSource = path.join(extractRoot, 'solid-api', 'src', moduleName);
            const solidUiSource = path.join(extractRoot, 'solid-ui', 'src', moduleName);

            await this.assertPathExists(solidApiSource, 'solid-api module source');
            await this.assertPathExists(solidUiSource, 'solid-ui module source');

            const metadataFilePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
            const installedMetadata = await this.readJsonFile(metadataFilePath);
            const userData = await this.resolveProtectedUserData(moduleName, transaction.manifest, transaction.metadataDocument);

            // Checked before the backup, the install and any write, so a refusal leaves the project untouched.
            if (userData.metadataKeys.length > 0 && await this.isInstalledMetadataUnreadable(moduleName)) {
                throw new BadRequestException(this.unreadableMetadataMessage(moduleName));
            }

            if (isUpdate) {
                transaction.backup = await this.backupModuleFolders(transactionKey, moduleName, transaction.installedVersion);
                await this.writeStatusFile(transactionKey, transaction);
            }

            // Packages first: new code that imports a missing package would otherwise fail to compile under a watching dev server.
            const dependencyOutputs = await this.installDeclaredDependencies(transaction.manifest, dto.skipDependencyInstall ?? false);

            const previousRecord = await readInstallRecord(solidApiTarget);
            const plan = await this.planImportSync(moduleName, extractRoot, userData);
            await fs.mkdir(solidApiTarget, { recursive: true });
            await fs.mkdir(solidUiTarget, { recursive: true });
            await applyModuleSync(plan, moduleName, solidApiTarget, solidUiTarget);

            // The metadata file carries the user's own entries (e.g. their applications); keep those, whatever the package shipped.
            if (userData.metadataKeys.length > 0) {
                const incomingDocument = await this.readJsonFile(metadataFilePath);
                const merged = mergeProtectedMetadataKeys(incomingDocument, installedMetadata, userData.metadataKeys);
                if (merged && JSON.stringify(merged) !== JSON.stringify(incomingDocument)) {
                    await fs.writeFile(metadataFilePath, JSON.stringify(merged, null, 2));
                }
            }

            // The installed metadata file records the installed version, whichever tool produced the package.
            await this.writeModuleVersion(metadataFilePath, transaction.incomingVersion);
            await writeInstallRecord(solidApiTarget, buildInstallRecord(plan, previousRecord, transaction.incomingVersion));

            if (transaction.extractDirPath) {
                await fs.rm(transaction.extractDirPath, { recursive: true, force: true });
                transaction.extractDirPath = null;
            }

            transaction.status = ModulePackageStatus.awaiting_restart;
            transaction.currentStep = 'restart';
            transaction.outputs.import = [
                isUpdate
                    ? `Updated ${moduleName} from ${this.formatVersion(transaction.installedVersion)} to ${this.formatVersion(transaction.incomingVersion)}`
                    : null,
                `Placed solid-api module at ${solidApiTarget}`,
                `Placed solid-ui module at ${solidUiTarget}`,
                `Metadata file placed at ${preview.requiredPaths.metadataPath}`,
                `Wrote ${plan.write.length} file(s), removed ${plan.remove.length}, kept ${plan.keptUserFiles.length} user-data and ${plan.keptOther.length} other file(s)`,
                plan.keptModified.length ? `Kept ${plan.keptModified.length} locally modified file(s) the package no longer ships: ${this.summarizePaths(plan.keptModified)}` : null,
                plan.droppedProtected.length ? `Ignored ${plan.droppedProtected.length} package file(s) under user-data paths: ${this.summarizePaths(plan.droppedProtected)}` : null,
                ...dependencyOutputs,
                transaction.backup ? `Backed up the previous module folders to ${transaction.backup.path}` : null,
            ].filter(Boolean).join('\n');
            await this.writeStatusFile(transactionKey, transaction);
            await this.syncActiveTransactionPointer(transaction);

            return this.toStatusResponse(transaction);
        } catch (error: any) {
            transaction.status = ModulePackageStatus.failed;
            transaction.currentStep = 'import';
            transaction.errorMessage = error.message ?? 'Failed to import the module package.';
            await this.writeStatusFile(transactionKey, transaction);
            await this.syncActiveTransactionPointer(transaction);
            throw error;
        }
    }

    @DisallowInProduction()
    async runBuild(transactionKey: string, dto: RunModulePackageBuildDto = {}) {
        const transaction = await this.loadTransaction(transactionKey);
        transaction.status = ModulePackageStatus.build_running;
        transaction.currentStep = 'build';
        transaction.errorMessage = null;
        await this.writeStatusFile(transactionKey, transaction);

        try {
            const buildSolidApi = dto.buildSolidApi ?? true;
            const buildSolidUi = dto.buildSolidUi ?? true;
            const outputs: string[] = [];
            const failedTargets: string[] = [];
            const projectRoot = this.getProjectRoot();

            if (buildSolidApi) {
                try {
                    const output = await this.commandService.executeCommandWithArgs({
                        command: 'npx',
                        args: ['-y', '@solidxai/solidctl@latest', 'build'],
                        cwd: projectRoot,
                    });
                    outputs.push(`solidctl build [success]\n${output}`.trim());
                } catch (error: any) {
                    failedTargets.push('solidctl build');
                    outputs.push(`solidctl build [failed]\n${error?.message ?? 'Build failed.'}`.trim());
                }
            }

            if (buildSolidUi) {
                try {
                    const output = await this.commandService.executeCommandWithArgs({
                        command: 'npx',
                        args: ['-y', '@solidxai/solidctl@latest', 'build', '--ui-only'],
                        cwd: projectRoot,
                    });
                    outputs.push(`solidctl build --ui-only [success]\n${output}`.trim());
                } catch (error: any) {
                    failedTargets.push('solidctl build --ui-only');
                    outputs.push(`solidctl build --ui-only [failed]\n${error?.message ?? 'Build failed.'}`.trim());
                }
            }

            transaction.status = failedTargets.length > 0
                ? ModulePackageStatus.build_failed
                : ModulePackageStatus.build_succeeded;
            transaction.currentStep = 'build';
            transaction.outputs.build = outputs.join('\n\n');
            transaction.errorMessage = failedTargets.length > 0
                ? `Build completed with errors in: ${failedTargets.join(', ')}`
                : null;
            await this.writeStatusFile(transactionKey, transaction);
            await this.syncActiveTransactionPointer(transaction);

            return this.toStatusResponse(transaction);
        } catch (error: any) {
            transaction.status = ModulePackageStatus.build_failed;
            transaction.currentStep = 'build';
            transaction.errorMessage = error.message ?? 'Build failed.';
            transaction.outputs.build = error.message ?? '';
            await this.writeStatusFile(transactionKey, transaction);
            await this.syncActiveTransactionPointer(transaction);
            throw error;
        }
    }

    @DisallowInProduction()
    async runSeed(transactionKey: string, dto: RunModulePackageSeedDto = {}) {
        const transaction = await this.loadTransaction(transactionKey);
        const moduleName = transaction.moduleName;

        if (!moduleName) {
            throw new BadRequestException('Unable to seed because the transaction is missing moduleName.');
        }

        transaction.status = ModulePackageStatus.seed_running;
        transaction.currentStep = 'seed';
        transaction.errorMessage = null;
        await this.writeStatusFile(transactionKey, transaction);

        try {
            const seedArgs = ['seed', '--modules-to-seed', moduleName, ...(dto.prune ? ['--prune'] : [])];
            const output = await this.commandService.executeCommandWithArgs({
                command: 'npx',
                args: ['-y', '@solidxai/solidctl@latest', ...seedArgs],
                cwd: this.getProjectRoot(),
            });
            transaction.status = ModulePackageStatus.completed;
            transaction.currentStep = 'done';
            transaction.outputs.seed = [
                `solidctl ${seedArgs.join(' ')} [success]`,
                output,
            ].filter(Boolean).join('\n');
            await this.writeStatusFile(transactionKey, transaction);
            await this.syncActiveTransactionPointer(transaction);

            return this.toStatusResponse(transaction);
        } catch (error: any) {
            transaction.status = ModulePackageStatus.seed_failed;
            transaction.currentStep = 'seed';
            transaction.errorMessage = error.message ?? 'Seed failed.';
            transaction.outputs.seed = error.message ?? '';
            await this.writeStatusFile(transactionKey, transaction);
            await this.syncActiveTransactionPointer(transaction);
            return this.toStatusResponse(transaction);
        }
    }

    // The most recent update backup of a module that has not been restored yet, so a finished update can still be rolled back.
    @DisallowInProduction()
    async getLatestBackup(moduleNameInput: string) {
        const moduleName = (moduleNameInput ?? '').trim();
        if (!moduleName) {
            throw new BadRequestException('A module name is required to look up its backup.');
        }

        await this.cleanupModulePackageTransactions();

        const candidates: ModulePackageStatusFile[] = [];
        for (const entry of await this.readDirSafe(this.getModulePackageImportsRoot())) {
            if (!entry.isDirectory() || !/^[a-zA-Z0-9-]+$/.test(entry.name)) {
                continue;
            }

            try {
                const transaction = await this.loadTransaction(entry.name);
                if (
                    transaction.moduleName === moduleName
                    && transaction.backup
                    && !transaction.restoredFromBackup
                    && this.isRestorableStatus(transaction.status)
                    && await this.pathExists(transaction.backup.path)
                ) {
                    candidates.push(transaction);
                }
            } catch (error) {
                continue;
            }
        }

        candidates.sort((left, right) => new Date(right.backup!.createdAt).getTime() - new Date(left.backup!.createdAt).getTime());
        const latest = candidates[0];
        if (!latest) {
            return null;
        }

        const installedState = await this.resolveInstalledState(moduleName);
        return {
            ...this.toStatusResponse(latest),
            currentVersion: installedState.version,
        };
    }

    @DisallowInProduction()
    async restoreBackup(transactionKey: string) {
        const transaction = await this.loadTransaction(transactionKey);
        const moduleName = transaction.moduleName;
        const backup = transaction.backup;

        if (!moduleName || !backup) {
            throw new BadRequestException('This module package transaction has no backup to restore.');
        }

        if (!this.isRestorableStatus(transaction.status)) {
            throw new BadRequestException(`A backup cannot be restored while the transaction is ${transaction.status}.`);
        }

        await this.assertPathExists(backup.path, 'module backup');

        transaction.status = ModulePackageStatus.restore_running;
        transaction.currentStep = 'restore';
        transaction.errorMessage = null;
        await this.writeStatusFile(transactionKey, transaction);

        try {
            // Same rules as an update, with the backup as the incoming side: files the update added go, the user's own files
            // and user data (even ones created after the update) stay, and the backed-up files come back.
            const apiTarget = this.getSolidApiModuleTargetPath(moduleName);
            const uiTarget = this.getSolidUiModuleTargetPath(moduleName);
            const backupApi = path.join(backup.path, 'solid-api');
            const backupUi = path.join(backup.path, 'solid-ui');
            const metadataFilePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
            const currentMetadata = await this.readJsonFile(metadataFilePath);
            const backupMetadata = await this.readJsonFile(path.join(backupApi, 'metadata', `${moduleName}-metadata.json`));
            const userData = mergeUserData(
                normalizeUserData(currentMetadata?.modulePackage?.userData),
                normalizeUserData(backupMetadata?.modulePackage?.userData),
            );

            const plan = await planModuleSync({
                moduleName,
                incoming: await this.listModuleFiles(moduleName, backupApi, backupUi),
                current: await this.listModuleFiles(moduleName, apiTarget, uiTarget),
                record: await readInstallRecord(apiTarget),
                userData,
                metadataPackagePath: this.buildExpectedPaths(moduleName).metadataPath,
            });
            await fs.mkdir(apiTarget, { recursive: true });
            await fs.mkdir(uiTarget, { recursive: true });
            await applyModuleSync(plan, moduleName, apiTarget, uiTarget);

            if (userData.metadataKeys.length > 0) {
                const restoredDocument = await this.readJsonFile(metadataFilePath);
                const merged = mergeProtectedMetadataKeys(restoredDocument, currentMetadata, userData.metadataKeys);
                if (merged && JSON.stringify(merged) !== JSON.stringify(restoredDocument)) {
                    await fs.writeFile(metadataFilePath, JSON.stringify(merged, null, 2));
                }
            }
            // The record goes back to what the backed-up version had (none for a legacy install).
            await writeInstallRecord(apiTarget, await readInstallRecord(backupApi));

            const outputs: string[] = [
                `Restored ${moduleName} ${this.formatVersion(backup.version)} from ${backup.path}`,
                `Wrote ${plan.write.length} file(s), removed ${plan.remove.length}, kept ${plan.keptUserFiles.length} user-data and ${plan.keptOther.length} other file(s)`,
                ...(await this.restoreProjectFiles(backup.path)),
            ];

            transaction.status = ModulePackageStatus.awaiting_restart;
            transaction.currentStep = 'restart';
            transaction.restoredFromBackup = true;
            transaction.outputs.restore = outputs.join('\n');
            transaction.outputs.build = null;
            transaction.outputs.seed = null;
            await this.writeStatusFile(transactionKey, transaction);
            await this.syncActiveTransactionPointer(transaction);

            return this.toStatusResponse(transaction);
        } catch (error: any) {
            transaction.status = ModulePackageStatus.failed;
            transaction.currentStep = 'restore';
            transaction.errorMessage = error.message ?? 'Failed to restore the module backup.';
            await this.writeStatusFile(transactionKey, transaction);
            await this.syncActiveTransactionPointer(transaction);
            throw error;
        }
    }

    private async parseArchive(archiveFilePath: string): Promise<ParsedArchive> {
        const entries = await this.listArchiveEntries(archiveFilePath);
        const archiveRootPrefix = this.detectArchiveRootPrefix(entries);
        const normalizedEntries = this.normalizeArchiveEntries(entries, archiveRootPrefix);
        const validationErrors: string[] = [];
        const validationWarnings: string[] = [];

        if (path.extname(archiveFilePath).toLowerCase() !== '.sldx') {
            validationErrors.push('Only .sldx archives are supported.');
        }

        const unsafeEntries = normalizedEntries.filter((entry) => this.isUnsafeArchivePath(entry));
        if (unsafeEntries.length > 0) {
            validationErrors.push(`Archive contains unsafe paths: ${unsafeEntries.join(', ')}`);
        }

        if (!normalizedEntries.includes('manifest.json')) {
            validationErrors.push('Archive is missing manifest.json at the root.');
        }

        const manifestArchivePath = this.toArchiveEntryPath(archiveRootPrefix, 'manifest.json');
        const manifestText = normalizedEntries.includes('manifest.json')
            ? await this.readArchiveEntry(archiveFilePath, manifestArchivePath)
            : '';
        const manifest = this.parseManifest(manifestText, validationErrors);

        if (!manifest) {
            return {
                entries: normalizedEntries,
                archiveRootPrefix,
                manifest: this.getFallbackManifest(),
                metadataDocument: null,
                validation: {
                    valid: false,
                    errors: validationErrors,
                    warnings: validationWarnings,
                },
                preview: {
                    module: { name: '', displayName: '' },
                    ...this.getEmptyInstallState(),
                    manifest: this.getFallbackManifest(),
                    contentsSummary: {
                        totalEntries: normalizedEntries.length,
                        solidApiEntries: normalizedEntries.filter((entry) => entry.startsWith('solid-api/')).length,
                        solidUiEntries: normalizedEntries.filter((entry) => entry.startsWith('solid-ui/')).length,
                    },
                    requiredPaths: {
                        metadataPath: '',
                        apiModulePath: '',
                        uiModulePath: '',
                    },
                    conflicts: [],
                    fileTree: normalizedEntries,
                    nextActions: ['Fix archive structure and upload again.'],
                    fileSync: null,
                    dependencies: null,
                },
            };
        }

        if (manifest.packageType !== ModulePackageService.SUPPORTED_PACKAGE_TYPE) {
            validationErrors.push(`manifest.json packageType must be "${ModulePackageService.SUPPORTED_PACKAGE_TYPE}".`);
        }
        if (!ModulePackageService.SUPPORTED_SCHEMA_VERSIONS.includes(manifest.schemaVersion)) {
            validationErrors.push(`manifest.json schemaVersion must be one of ${ModulePackageService.SUPPORTED_SCHEMA_VERSIONS.map((version) => `"${version}"`).join(', ')}.`);
        }
        if (!manifest.module?.name) {
            validationErrors.push('manifest.json module.name is required.');
        }
        if (manifest.module?.version !== undefined && manifest.module?.version !== null && !this.toValidVersion(manifest.module.version)) {
            validationErrors.push(`manifest.json module.version "${manifest.module.version}" is not a valid semver version.`);
        }
        if (!this.toValidVersion(manifest.module?.version)) {
            validationWarnings.push('This package is unversioned.');
        }

        const moduleName = manifest.module?.name ?? '';
        const expectedPaths = this.buildExpectedPaths(moduleName);

        if (manifest.contents?.metadataPath !== expectedPaths.metadataPath) {
            validationErrors.push(`manifest.json contents.metadataPath must be "${expectedPaths.metadataPath}".`);
        }
        if (manifest.contents?.apiModulePath !== expectedPaths.apiModulePath) {
            validationErrors.push(`manifest.json contents.apiModulePath must be "${expectedPaths.apiModulePath}".`);
        }
        if (manifest.contents?.uiModulePath !== expectedPaths.uiModulePath) {
            validationErrors.push(`manifest.json contents.uiModulePath must be "${expectedPaths.uiModulePath}".`);
        }

        if (!normalizedEntries.includes(expectedPaths.metadataPath)) {
            validationErrors.push(`Archive is missing ${expectedPaths.metadataPath}.`);
        }
        if (!normalizedEntries.includes(expectedPaths.apiModulePath)) {
            validationErrors.push(`Archive is missing ${expectedPaths.apiModulePath}.`);
        }
        if (!normalizedEntries.includes(expectedPaths.uiModulePath)) {
            validationErrors.push(`Archive is missing ${expectedPaths.uiModulePath}.`);
        }

        const metadataDocument = normalizedEntries.includes(expectedPaths.metadataPath)
            ? this.parseMetadataDocument(
                await this.readArchiveEntry(archiveFilePath, this.toArchiveEntryPath(archiveRootPrefix, expectedPaths.metadataPath)),
                validationErrors,
            )
            : null;

        const metadataModuleName = metadataDocument?.moduleMetadata?.name;
        if (metadataModuleName && metadataModuleName !== moduleName) {
            validationErrors.push(`Metadata module name "${metadataModuleName}" does not match manifest module name "${moduleName}".`);
        }

        if (!manifest.checksums || Object.keys(manifest.checksums).length === 0) {
            validationWarnings.push('manifest.json does not include checksums. Checksums are recommended.');
        }

        const conflicts = await this.detectConflicts(moduleName);
        if (conflicts.length > 0) {
            validationWarnings.push(ModulePackageService.OVERWRITE_CONFIRMATION_WARNING);
        }

        const validation: ValidationPayload = {
            valid: validationErrors.length === 0,
            errors: validationErrors,
            warnings: validationWarnings,
        };

        const preview: PreviewPayload = {
            module: manifest.module,
            ...this.getEmptyInstallState(),
            incomingVersion: this.toValidVersion(manifest.module?.version),
            manifest,
            contentsSummary: {
                totalEntries: normalizedEntries.length,
                solidApiEntries: normalizedEntries.filter((entry) => entry.startsWith('solid-api/')).length,
                solidUiEntries: normalizedEntries.filter((entry) => entry.startsWith('solid-ui/')).length,
            },
            requiredPaths: expectedPaths,
            conflicts,
            fileTree: normalizedEntries,
            nextActions: [
                'Review archive preview.',
                'Confirm import to place files locally.',
                'Wait for service restart, then run build and seed.',
            ],
            fileSync: null,
            dependencies: null,
        };

        return {
            entries: normalizedEntries,
            archiveRootPrefix,
            manifest,
            metadataDocument,
            validation,
            preview,
        };
    }

    private getEmptyInstallState() {
        return {
            mode: 'install' as ModulePackageMode,
            installedVersion: null,
            incomingVersion: null,
            versionComparison: null,
            requiresVersionAcknowledgement: false,
            identicalContent: false,
            contentFingerprint: null,
            changeSet: null,
        };
    }

    // Works out whether this is an install or an update of an existing module and fills the
    // version / change-set parts of the preview. Runs after extraction because it needs file contents.
    private async applyInstallStateToPreview(parsed: ParsedArchive, extractRoot: string, expectedModuleName: string | null) {
        const { preview, validation } = parsed;
        const moduleName = parsed.manifest.module?.name ?? '';

        if (expectedModuleName && moduleName !== expectedModuleName) {
            validation.errors.push(`This package is for module "${moduleName || 'unknown'}", but you are updating "${expectedModuleName}".`);
        }

        if (moduleName) {
            validation.errors.push(...await this.verifyArchiveChecksums(parsed.manifest, extractRoot));

            const installedState = await this.resolveInstalledState(moduleName);
            const userData = await this.resolveProtectedUserData(moduleName, parsed.manifest, parsed.metadataDocument);

            const incomingChecksums = await this.computeModuleContentChecksums(
                path.join(extractRoot, 'solid-api', 'src', moduleName),
                path.join(extractRoot, 'solid-ui', 'src', moduleName),
                moduleName,
                userData,
            );
            preview.contentFingerprint = this.computeContentFingerprint(incomingChecksums);
            preview.dependencies = await this.buildDependencyPreview(parsed.manifest);
            preview.versionComparison = this.compareModuleVersions(installedState, preview.incomingVersion);

            if (installedState.installed) {
                const installedChecksums = await this.computeModuleContentChecksums(
                    this.getSolidApiModuleTargetPath(moduleName),
                    this.getSolidUiModuleTargetPath(moduleName),
                    moduleName,
                    userData,
                );

                if (userData.metadataKeys.length > 0 && await this.isInstalledMetadataUnreadable(moduleName)) {
                    validation.errors.push(this.unreadableMetadataMessage(moduleName));
                }

                // Only what a package can change counts: files the user added, and ones kept because they were
                // modified locally, are neither "removed" nor a difference from the package.
                const plan = await this.planImportSync(moduleName, extractRoot, userData);
                for (const kept of [...plan.keptOther, ...plan.keptModified]) {
                    delete installedChecksums[kept];
                }

                preview.mode = 'update';
                preview.installedVersion = installedState.version;
                preview.identicalContent = this.computeContentFingerprint(installedChecksums) === preview.contentFingerprint;
                preview.changeSet = {
                    solidApi: this.diffChecksums(installedChecksums, incomingChecksums, `solid-api/src/${moduleName}/`),
                    solidUi: this.diffChecksums(installedChecksums, incomingChecksums, `solid-ui/src/${moduleName}/`),
                };
                preview.requiresVersionAcknowledgement = preview.identicalContent
                    || ModulePackageService.VERSION_ACKNOWLEDGEMENT_COMPARISONS.includes(preview.versionComparison);
                preview.fileSync = this.summarizeSyncPlan(plan, userData);
                preview.nextActions = [
                    'Review the version change and the files that will change.',
                    'Approve the update. Files the package installed are updated; your own files and user data are left alone. The current folders are backed up first.',
                    'Wait for service restart, then run build and seed.',
                ];

                validation.warnings = validation.warnings.filter((warning) => warning !== ModulePackageService.OVERWRITE_CONFIRMATION_WARNING);
                validation.warnings.push(...this.buildUpdateWarnings(preview));
            }

            validation.warnings.push(...this.buildDependencyWarnings(preview.dependencies));
        }

        validation.valid = validation.errors.length === 0;
    }

    private buildDependencyWarnings(dependencies: ModulePackageDependencyPreview | null): string[] {
        if (!dependencies) {
            return [];
        }

        const warnings: string[] = [];
        const describe = (statuses: DependencyStatus[], state: DependencyStatus['state']) =>
            statuses.filter((status) => status.state === state);
        const all = [...dependencies.solidApi, ...dependencies.solidUi];

        const missing = describe(all, 'missing');
        if (missing.length > 0) {
            warnings.push(`Confirming installs ${missing.map((status) => `${status.name}@${status.range}`).join(', ')} (${dependencies.installCommands.join('; ')}).`);
        }
        for (const status of describe(all, 'mismatch')) {
            warnings.push(`${status.name} ${status.installedVersion} is installed but this module needs ${status.range}. It is left as it is; update it yourself if the module misbehaves.`);
        }

        const prerequisites = dependencies.prerequisites
            .map((entry) => [entry.name, entry.version].filter((part) => typeof part === 'string' && part).join(' '))
            .filter(Boolean);
        if (prerequisites.length > 0) {
            warnings.push(`This module also needs these on the machine that runs it (never installed for you): ${prerequisites.join(', ')}.`);
        }
        return warnings;
    }

    // True when the installed metadata file exists but is not valid JSON.
    private async isInstalledMetadataUnreadable(moduleName: string): Promise<boolean> {
        const metadataFilePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        if (!(await this.pathExists(metadataFilePath))) {
            return false;
        }
        return (await this.readJsonFile(metadataFilePath)) === null;
    }

    private unreadableMetadataMessage(moduleName: string) {
        return `The installed metadata file for "${moduleName}" can't be read, so the user data in it (such as the application list) can't be kept. Fix or restore the file and upload the package again.`;
    }

    private buildUpdateWarnings(preview: PreviewPayload): string[] {
        const installed = this.formatVersion(preview.installedVersion);
        const incoming = this.formatVersion(preview.incomingVersion);
        const warnings: string[] = [];

        if (preview.versionComparison === 'downgrade') {
            warnings.push(`This package (${incoming}) is older than the installed version (${installed}).`);
        } else if (preview.versionComparison === 'same') {
            warnings.push(preview.identicalContent
                ? `${installed} is already installed with identical content.`
                : `${installed} is already installed, but this package's content is different.`);
        } else if (preview.versionComparison === 'legacy_package' && preview.installedVersion) {
            warnings.push(`The installed module is ${installed}, but this package is unversioned. After the update the module will be unversioned.`);
        }

        if (preview.identicalContent && preview.versionComparison !== 'same') {
            warnings.push('The package content is identical to the installed module.');
        }

        const sync = preview.fileSync;
        if (sync?.locallyModifiedReplaced.length) {
            warnings.push(`${sync.locallyModifiedReplaced.length} package file(s) were changed locally and will be replaced (the backup keeps your version): ${this.summarizePaths(sync.locallyModifiedReplaced)}.`);
        }
        if (sync?.keptModifiedFiles.length) {
            warnings.push(`${sync.keptModifiedFiles.length} file(s) removed from the package were changed locally and will be kept: ${this.summarizePaths(sync.keptModifiedFiles)}.`);
        }
        if (sync?.droppedProtected.length) {
            warnings.push(`The package contains ${sync.droppedProtected.length} file(s) under user-data paths; they will be ignored: ${this.summarizePaths(sync.droppedProtected)}.`);
        }
        if (sync?.legacyInstall) {
            warnings.push('No install record was found for this module, so no files will be deleted. Files removed from the package may remain; remove stale ones by hand.');
        }
        warnings.push('Updating writes the package files over the installed module. Files you added and declared user data are not touched; the current folders are backed up first.');
        return warnings;
    }

    private compareModuleVersions(installedState: InstalledModuleState, incomingVersion: string | null): ModulePackageVersionComparison {
        if (!installedState.installed) {
            return 'new';
        }
        if (!incomingVersion) {
            return 'legacy_package';
        }
        if (!installedState.version) {
            return 'first_version';
        }

        const comparison = semver.compare(incomingVersion, installedState.version);
        return comparison > 0 ? 'upgrade' : comparison === 0 ? 'same' : 'downgrade';
    }

    private async assertUpdateApproved(transaction: ModulePackageStatusFile, dto: ConfirmModulePackageImportDto) {
        const moduleName = transaction.moduleName as string;
        const incomingVersion = transaction.incomingVersion ?? null;

        if ((dto.confirmedVersion ?? null) !== incomingVersion) {
            throw new BadRequestException({
                message: `Approve the update to ${this.formatVersion(incomingVersion)} to continue.`,
                incomingVersion,
            });
        }

        if (transaction.preview?.requiresVersionAcknowledgement && !dto.acknowledgeVersionChange) {
            throw new BadRequestException(
                'This update is a reinstall, a downgrade, identical content or an unversioned package. Acknowledge the version change to continue.',
            );
        }

        const replacedLocally = transaction.preview?.fileSync?.locallyModifiedReplaced ?? [];
        if (replacedLocally.length && !dto.acknowledgeLocalChanges) {
            throw new BadRequestException({
                message: `${replacedLocally.length} file(s) changed locally will be replaced by this update (the backup keeps your versions): ${this.summarizePaths(replacedLocally)}. Acknowledge the local changes to continue.`,
                locallyModifiedReplaced: replacedLocally,
            });
        }

        const currentState = await this.resolveInstalledState(moduleName);
        if (!currentState.installed || currentState.version !== transaction.installedVersion) {
            throw new BadRequestException(
                `The installed module changed since this package was previewed (now ${this.formatVersion(currentState.version)}). Upload the package again to refresh the preview.`,
            );
        }
    }

    private async resolveInstalledState(moduleName: string): Promise<InstalledModuleState> {
        const metadataFilePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        const installed = (await this.pathExists(this.getSolidApiModuleTargetPath(moduleName)))
            || (await this.pathExists(this.getSolidUiModuleTargetPath(moduleName)))
            || (await this.pathExists(metadataFilePath));

        let version: string | null = null;
        if (await this.pathExists(metadataFilePath)) {
            try {
                const metadataDocument = JSON.parse(await fs.readFile(metadataFilePath, 'utf-8'));
                version = this.toValidVersion(metadataDocument?.moduleMetadata?.version);
            } catch (error) {
                version = null;
            }
        }

        return { installed, version };
    }

    private async verifyArchiveChecksums(manifest: ModulePackageManifest, extractRoot: string): Promise<string[]> {
        const expected = manifest.checksums;
        if (!expected || Object.keys(expected).length === 0) {
            return [];
        }

        const actual = await this.computeDirectoryChecksums(extractRoot, ['manifest.json']);
        const actualPaths = Object.keys(actual).filter((entry) => !this.isMacOsMetadataEntry(entry));
        const missing = Object.keys(expected).filter((entry) => !(entry in actual));
        const unexpected = actualPaths.filter((entry) => !(entry in expected));
        const mismatched = Object.keys(expected).filter((entry) => entry in actual && actual[entry] !== expected[entry]);
        const errors: string[] = [];

        if (mismatched.length > 0) {
            errors.push(`Checksum mismatch for ${this.summarizePaths(mismatched)}. The package may be corrupted or was modified after export.`);
        }
        if (missing.length > 0) {
            errors.push(`Archive is missing files listed in manifest.json checksums: ${this.summarizePaths(missing)}.`);
        }
        if (unexpected.length > 0) {
            errors.push(`Archive contains files not listed in manifest.json checksums: ${this.summarizePaths(unexpected)}.`);
        }

        return errors;
    }

    // Checksums keyed by package path (solid-api/src/<m>/..., solid-ui/src/<m>/...). The metadata file is
    // hashed without its version so a version bump alone does not count as a content change.
    // User-data files and the install record are left out, and protected metadata keys are emptied before hashing,
    // so only what a package can change counts.
    private async computeModuleContentChecksums(solidApiDir: string, solidUiDir: string, moduleName: string, userData: ModulePackageUserData = normalizeUserData(null)): Promise<Record<string, string>> {
        const checksums: Record<string, string> = {};
        const roots: Array<[string, string]> = [
            [`solid-api/src/${moduleName}`, solidApiDir],
            [`solid-ui/src/${moduleName}`, solidUiDir],
        ];

        for (const [prefix, rootDir] of roots) {
            if (!(await this.pathExists(rootDir))) {
                continue;
            }

            const rootChecksums = await this.computeDirectoryChecksums(rootDir);
            for (const [relativePath, checksum] of Object.entries(rootChecksums)) {
                if (this.isMacOsMetadataEntry(relativePath) || path.posix.basename(relativePath) === '.DS_Store' || relativePath === INSTALL_RECORD_FILE) {
                    continue;
                }
                if (isProtectedPackagePath(`${prefix}/${relativePath}`, moduleName, userData)) {
                    continue;
                }
                checksums[`${prefix}/${relativePath}`] = checksum;
            }
        }

        const metadataKey = `solid-api/src/${moduleName}/metadata/${moduleName}-metadata.json`;
        if (checksums[metadataKey]) {
            const metadataText = await fs.readFile(path.join(solidApiDir, 'metadata', `${moduleName}-metadata.json`), 'utf-8');
            try {
                const versionless = withEmptiedMetadataKeys(this.withModuleVersion(JSON.parse(metadataText), null), userData.metadataKeys);
                checksums[metadataKey] = createHash('sha256').update(JSON.stringify(versionless)).digest('hex');
            } catch (error) {
                // Unparseable metadata keeps its raw checksum.
            }
        }

        return checksums;
    }

    private computeContentFingerprint(checksums: Record<string, string>): string {
        const lines = Object.keys(checksums).sort().map((entry) => `${entry}:${checksums[entry]}`);
        return createHash('sha256').update(lines.join('\n')).digest('hex');
    }

    private diffChecksums(installed: Record<string, string>, incoming: Record<string, string>, prefix: string): ModulePackageFileDiff {
        const strip = (entries: string[]) => entries.filter((entry) => entry.startsWith(prefix)).map((entry) => entry.slice(prefix.length)).sort();
        const installedPaths = Object.keys(installed);
        const incomingPaths = Object.keys(incoming);

        const added = strip(incomingPaths.filter((entry) => !(entry in installed)));
        const removed = strip(installedPaths.filter((entry) => !(entry in incoming)));
        const shared = incomingPaths.filter((entry) => entry in installed);
        const modified = strip(shared.filter((entry) => installed[entry] !== incoming[entry]));
        const unchangedCount = strip(shared.filter((entry) => installed[entry] === incoming[entry])).length;

        return { added, modified, removed, unchangedCount };
    }

    private async backupModuleFolders(transactionKey: string, moduleName: string, version: string | null): Promise<ModulePackageBackup> {
        const backupPath = path.join(this.getModulePackageBackupsRoot(), transactionKey);
        await fs.rm(backupPath, { recursive: true, force: true });
        await fs.mkdir(backupPath, { recursive: true });

        const sources: Array<[string, string]> = [
            ['solid-api', this.getSolidApiModuleTargetPath(moduleName)],
            ['solid-ui', this.getSolidUiModuleTargetPath(moduleName)],
        ];
        for (const [label, sourcePath] of sources) {
            if (await this.pathExists(sourcePath)) {
                await fs.cp(sourcePath, path.join(backupPath, label), { recursive: true });
            }
        }

        // package.json and lock files, so a restore can undo the packages an update installed.
        for (const { name, dir } of await this.dependencyAppDirs()) {
            for (const file of PROJECT_FILES_TO_BACK_UP) {
                if (await this.pathExists(path.join(dir, file))) {
                    await fs.mkdir(path.join(backupPath, 'project-files', name), { recursive: true });
                    await fs.copyFile(path.join(dir, file), path.join(backupPath, 'project-files', name, file));
                }
            }
        }

        const backup: ModulePackageBackup = { path: backupPath, version, createdAt: new Date().toISOString() };
        await fs.writeFile(path.join(backupPath, 'backup.json'), JSON.stringify({ moduleName, ...backup }, null, 2));
        return backup;
    }

    // Puts package.json and the lock file back when an update changed them, then lets the package manager settle node_modules.
    private async restoreProjectFiles(backupPath: string): Promise<string[]> {
        const outputs: string[] = [];
        for (const { name, dir } of await this.dependencyAppDirs()) {
            const backedUpDir = path.join(backupPath, 'project-files', name);
            let packageJsonChanged = false;
            for (const file of PROJECT_FILES_TO_BACK_UP) {
                const backedUp = path.join(backedUpDir, file);
                if (!(await this.pathExists(backedUp))) {
                    continue;
                }
                const current = path.join(dir, file);
                const changed = !(await this.pathExists(current)) || (await fs.readFile(backedUp, 'utf-8')) !== (await fs.readFile(current, 'utf-8'));
                if (changed) {
                    await fs.copyFile(backedUp, current);
                    outputs.push(`Restored ${name}/${file}`);
                    packageJsonChanged = packageJsonChanged || file === 'package.json';
                }
            }

            if (packageJsonChanged) {
                try {
                    const { command, args } = await buildInstallAllCommand(dir);
                    await this.commandService.executeCommandWithArgs({ command, args, cwd: dir });
                    outputs.push(`${name}: ${command} install finished`);
                } catch (error: any) {
                    outputs.push(`${name}: npm install failed (${error?.message ?? 'unknown error'}). Run it by hand.`);
                }
            }
        }
        return outputs;
    }

    private resolveExportVersion(currentVersion: string | null, dto: ExportModulePackageDto): string | null {
        const explicitVersion = (dto.version ?? '').trim();
        if (explicitVersion) {
            const version = this.toValidVersion(explicitVersion);
            if (!version) {
                throw new BadRequestException(`"${explicitVersion}" is not a valid semver version.`);
            }
            // An explicit version only sets the initial version; versioned modules move forward with a bump.
            if (currentVersion && version !== currentVersion) {
                throw new BadRequestException(`This module is already at v${currentVersion}. Choose a patch, minor or major bump instead.`);
            }
            return version;
        }

        const bump = dto.bump ?? 'none';
        if (bump === 'none') {
            return currentVersion;
        }

        const nextVersion = semver.inc(currentVersion ?? '0.0.0', bump);
        if (!nextVersion) {
            throw new BadRequestException(`Unable to bump version ${currentVersion ?? '0.0.0'} by ${bump}.`);
        }
        return nextVersion;
    }

    // Writes the version into the metadata file, leaving the file untouched when it already matches.
    private async writeModuleVersion(metadataFilePath: string, version: string | null) {
        const currentDocument = JSON.parse(await fs.readFile(metadataFilePath, 'utf-8'));
        if ((currentDocument?.moduleMetadata?.version ?? null) === version) {
            return currentDocument;
        }

        const metadataDocument = this.withModuleVersion(currentDocument, version);
        await fs.writeFile(metadataFilePath, JSON.stringify(metadataDocument, null, 2));
        return metadataDocument;
    }

    // Returns a copy of the metadata document with moduleMetadata.version set right after name, or removed when null.
    private withModuleVersion(metadataDocument: any, version: string | null) {
        if (!metadataDocument?.moduleMetadata) {
            return metadataDocument;
        }

        const { version: _previousVersion, ...moduleMetadata } = metadataDocument.moduleMetadata;
        const entries = Object.entries(moduleMetadata);
        if (version) {
            entries.splice(entries.findIndex(([key]) => key === 'name') + 1, 0, ['version', version]);
        }

        return { ...metadataDocument, moduleMetadata: Object.fromEntries(entries) };
    }

    private async syncModuleVersionInDb(moduleName: string, version: string | null) {
        try {
            await this.dataSource.getRepository(ModuleMetadata).update({ name: moduleName }, { version });
        } catch (error) {
            this.logger.warn(`Failed to update the version of module ${moduleName} in the database: ${String(error)}`);
        }
    }

    private toValidVersion(value: unknown): string | null {
        return typeof value === 'string' ? semver.valid(value.trim()) : null;
    }

    private formatVersion(version: string | null | undefined) {
        return version ? `v${version}` : 'unversioned';
    }

    private summarizePaths(paths: string[], limit = 5) {
        const shown = paths.slice(0, limit).join(', ');
        return paths.length > limit ? `${shown} and ${paths.length - limit} more` : shown;
    }

    private resolveExtractRoot(extractDirPath: string, archiveRootPrefix: string | null) {
        return archiveRootPrefix
            ? path.join(extractDirPath, archiveRootPrefix.replace(/\/$/, ''))
            : extractDirPath;
    }

    private parseManifest(manifestText: string, validationErrors: string[]): ModulePackageManifest | null {
        if (!manifestText) {
            return null;
        }

        try {
            return JSON.parse(manifestText) as ModulePackageManifest;
        } catch (error) {
            validationErrors.push('manifest.json is not valid JSON.');
            return null;
        }
    }

    private parseMetadataDocument(documentText: string, validationErrors: string[]) {
        try {
            return JSON.parse(documentText);
        } catch (error) {
            validationErrors.push('Module metadata JSON is not valid JSON.');
            return null;
        }
    }

    private async listArchiveEntries(archiveFilePath: string): Promise<string[]> {
        const output = await this.commandService.executeCommandWithArgs({
            command: 'unzip',
            args: ['-Z1', archiveFilePath],
        });

        return output
            .split(/\r?\n/)
            .map((entry) => entry.trim())
            .filter(Boolean);
    }

    private async readArchiveEntry(archiveFilePath: string, entryPath: string): Promise<string> {
        return this.commandService.executeCommandWithArgs({
            command: 'unzip',
            args: ['-p', archiveFilePath, entryPath],
        });
    }

    private async extractArchive(archiveFilePath: string, extractDirPath: string) {
        await this.commandService.executeCommandWithArgs({
            command: 'unzip',
            args: ['-o', archiveFilePath, '-d', extractDirPath],
        });
    }

    private async detectConflicts(moduleName: string): Promise<string[]> {
        const conflicts: string[] = [];
        const solidApiTarget = this.getSolidApiModuleTargetPath(moduleName);
        const solidUiTarget = this.getSolidUiModuleTargetPath(moduleName);
        const metadataFilePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);

        if (await this.pathExists(solidApiTarget)) {
            conflicts.push(`solid-api module already exists at ${solidApiTarget}`);
        }
        if (await this.pathExists(solidUiTarget)) {
            conflicts.push(`solid-ui module already exists at ${solidUiTarget}`);
        }
        if (await this.pathExists(metadataFilePath)) {
            conflicts.push(`module metadata already exists at ${metadataFilePath}`);
        }

        return conflicts;
    }

    private buildExpectedPaths(moduleName: string) {
        return {
            metadataPath: `solid-api/src/${moduleName}/metadata/${moduleName}-metadata.json`,
            apiModulePath: `solid-api/src/${moduleName}/${moduleName}.module.ts`,
            uiModulePath: `solid-ui/src/${moduleName}/${moduleName}.ui-module.ts`,
        };
    }

    private detectArchiveRootPrefix(entries: string[]): string | null {
        const normalized = entries
            .map((entry) => entry.trim())
            .filter(Boolean)
            .filter((entry) => !this.isMacOsMetadataEntry(entry));

        if (normalized.length === 0) {
            return null;
        }

        const topLevelSegments = normalized
            .map((entry) => entry.split('/')[0])
            .filter(Boolean);

        const uniqueTopLevelSegments = Array.from(new Set(topLevelSegments));
        if (uniqueTopLevelSegments.length !== 1) {
            return null;
        }

        const onlySegment = uniqueTopLevelSegments[0];
        const hasNestedEntries = normalized.some((entry) => entry.startsWith(`${onlySegment}/`));
        return hasNestedEntries ? `${onlySegment}/` : null;
    }

    private normalizeArchiveEntries(entries: string[], archiveRootPrefix: string | null) {
        const filteredEntries = entries.filter((entry) => !this.isMacOsMetadataEntry(entry));

        if (!archiveRootPrefix) {
            return filteredEntries;
        }

        return filteredEntries
            .map((entry) => entry.startsWith(archiveRootPrefix) ? entry.slice(archiveRootPrefix.length) : entry)
            .filter(Boolean);
    }

    private toArchiveEntryPath(archiveRootPrefix: string | null, normalizedEntryPath: string) {
        return archiveRootPrefix ? `${archiveRootPrefix}${normalizedEntryPath}` : normalizedEntryPath;
    }

    private isUnsafeArchivePath(entry: string) {
        return entry.startsWith('/') || entry.includes('..') || /^[A-Za-z]:/.test(entry);
    }

    private isMacOsMetadataEntry(entry: string) {
        const normalizedEntry = entry.trim();
        if (!normalizedEntry) {
            return false;
        }

        const segments = normalizedEntry.split('/').filter(Boolean);
        return segments.some((segment) => segment === '__MACOSX' || segment.startsWith('._'));
    }

    private getFallbackManifest(): ModulePackageManifest {
        return {
            schemaVersion: ModulePackageService.SUPPORTED_SCHEMA_VERSION,
            packageType: ModulePackageService.SUPPORTED_PACKAGE_TYPE,
            module: { name: '', displayName: '' },
            contents: {
                metadataPath: '',
                apiModulePath: '',
                uiModulePath: '',
            },
        };
    }

    private async loadTransaction(transactionKey: string) {
        this.assertSafeTransactionKey(transactionKey);
        const statusFilePath = this.getStatusFilePath(transactionKey);

        if (!(await this.pathExists(statusFilePath))) {
            throw new NotFoundException(`Module package transaction ${transactionKey} was not found.`);
        }

        return this.normalizeTransaction(JSON.parse(await fs.readFile(statusFilePath, 'utf-8')));
    }

    // Status files written before module versioning existed lack the update fields; default them so those imports still resume.
    private normalizeTransaction(transaction: any): ModulePackageStatusFile {
        return {
            ...transaction,
            mode: transaction.mode ?? 'install',
            installedVersion: transaction.installedVersion ?? null,
            incomingVersion: transaction.incomingVersion ?? this.toValidVersion(transaction.manifest?.module?.version),
            versionComparison: transaction.versionComparison ?? null,
            backup: transaction.backup ?? null,
            restoredFromBackup: transaction.restoredFromBackup ?? false,
            outputs: {
                import: null,
                build: null,
                seed: null,
                restore: null,
                ...(transaction.outputs ?? {}),
            },
        };
    }

    private isResumableStatus(status: string | null | undefined) {
        return [
            ModulePackageStatus.import_running,
            ModulePackageStatus.awaiting_restart,
            ModulePackageStatus.build_running,
            ModulePackageStatus.build_failed,
            ModulePackageStatus.build_succeeded,
            ModulePackageStatus.seed_running,
            ModulePackageStatus.seed_failed,
            ModulePackageStatus.restore_running,
        ].includes(status as ModulePackageStatus);
    }

    private isRestorableStatus(status: string | null | undefined) {
        return this.isResumableStatus(status)
            || [ModulePackageStatus.failed, ModulePackageStatus.completed].includes(status as ModulePackageStatus);
    }

    private async createWorkingDir(transactionKey: string) {
        const baseDir = path.join(
            this.getModulePackageImportsRoot(),
            transactionKey,
        );

        await fs.mkdir(baseDir, { recursive: true });
        return baseDir;
    }

    private getSolidApiRoot() {
        return process.cwd();
    }

    private getProjectRoot() {
        return path.resolve(this.getSolidApiRoot(), '..');
    }

    private getSolidUiRoot() {
        return path.join(this.getProjectRoot(), 'solid-ui');
    }

    private getModulePackageImportsRoot() {
        return path.join(
            this.getModulePackageRuntimeRoot(),
            'module-package-imports',
        );
    }

    private getModulePackageExportsRoot() {
        return path.join(
            this.getModulePackageRuntimeRoot(),
            'module-package-exports',
        );
    }

    private getModulePackageBackupsRoot() {
        return path.join(
            this.getModulePackageRuntimeRoot(),
            'module-package-backups',
        );
    }

    private getModulePackageRuntimeRoot() {
        const configuredRuntimeRoot = process.env.SOLIDX_MODULE_PACKAGE_RUNTIME_DIR?.trim();

        if (configuredRuntimeRoot) {
            return path.resolve(configuredRuntimeRoot);
        }

        return path.join(
            this.getProjectRoot(),
            '.solidx-runtime',
        );
    }

    private getSolidApiModuleTargetPath(moduleName: string) {
        return path.join(this.getSolidApiRoot(), 'src', moduleName);
    }

    private getSolidUiModuleTargetPath(moduleName: string) {
        return path.join(this.getSolidUiRoot(), 'src', moduleName);
    }

    private async pathExists(targetPath: string) {
        try {
            await fs.access(targetPath);
            return true;
        } catch (error) {
            return false;
        }
    }

    private async assertPathExists(targetPath: string, label: string) {
        if (!(await this.pathExists(targetPath))) {
            throw new BadRequestException(`Expected ${label} at ${targetPath}, but it was not found in the extracted archive.`);
        }
    }

    private async readDirSafe(targetPath: string) {
        try {
            return await fs.readdir(targetPath, { withFileTypes: true });
        } catch (error) {
            return [];
        }
    }

    private assertSafeTransactionKey(transactionKey: string) {
        if (!/^[a-zA-Z0-9-]+$/.test(transactionKey)) {
            throw new BadRequestException('Invalid module package transaction key.');
        }
    }

    private getStatusFilePath(transactionKey: string) {
        this.assertSafeTransactionKey(transactionKey);
        return path.join(this.getModulePackageImportsRoot(), transactionKey, 'status.json');
    }

    private getActiveTransactionFilePath() {
        return path.join(this.getModulePackageImportsRoot(), 'active-transaction.json');
    }

    private async writeStatusFile(transactionKey: string, payload: ModulePackageStatusFile) {
        payload.updatedAt = new Date().toISOString();
        const statusFilePath = this.getStatusFilePath(transactionKey);
        await fs.mkdir(path.dirname(statusFilePath), { recursive: true });
        await fs.writeFile(statusFilePath, JSON.stringify(payload, null, 2));
    }

    private async markActiveTransaction(transactionKey: string) {
        const activeTransactionFilePath = this.getActiveTransactionFilePath();
        await fs.mkdir(path.dirname(activeTransactionFilePath), { recursive: true });
        const payload: ModulePackageActiveTransactionFile = {
            transactionKey,
            updatedAt: new Date().toISOString(),
        };
        await fs.writeFile(activeTransactionFilePath, JSON.stringify(payload, null, 2));
    }

    private async clearActiveTransactionIfMatches(transactionKey: string) {
        const activeTransaction = await this.loadActiveTransactionPointer();
        if (!activeTransaction || activeTransaction.transactionKey !== transactionKey) {
            return;
        }

        await fs.rm(this.getActiveTransactionFilePath(), { force: true });
    }

    private async loadActiveTransactionPointer(): Promise<ModulePackageActiveTransactionFile | null> {
        try {
            return JSON.parse(await fs.readFile(this.getActiveTransactionFilePath(), 'utf-8')) as ModulePackageActiveTransactionFile;
        } catch (error) {
            return null;
        }
    }

    private async syncActiveTransactionPointer(transaction: ModulePackageStatusFile) {
        if (this.isResumableStatus(transaction.status)) {
            await this.markActiveTransaction(transaction.transactionKey);
            return;
        }

        await this.clearActiveTransactionIfMatches(transaction.transactionKey);
    }

    private async collectRuntimeCleanupSnapshot() {
        const importEntries = await this.readDirSafe(this.getModulePackageImportsRoot());
        const exportEntries = await this.readDirSafe(this.getModulePackageExportsRoot());
        const backupEntries = await this.readDirSafe(this.getModulePackageBackupsRoot());

        const importTransactionEntries = importEntries.filter(
            (entry) => entry.isDirectory() && /^[a-zA-Z0-9-]+$/.test(entry.name),
        );
        const exportTransactionEntries = exportEntries.filter(
            (entry) => entry.isDirectory() && /^[a-zA-Z0-9-]+$/.test(entry.name),
        );

        const importLooseEntries = importEntries.filter(
            (entry) => !(entry.isDirectory() && /^[a-zA-Z0-9-]+$/.test(entry.name)),
        );
        const exportLooseEntries = exportEntries.filter(
            (entry) => !(entry.isDirectory() && /^[a-zA-Z0-9-]+$/.test(entry.name)),
        );

        return {
            removedImportTransactions: importTransactionEntries.length,
            removedExportTransactions: exportTransactionEntries.length,
            removedImportLooseEntries: importLooseEntries.length,
            removedExportLooseEntries: exportLooseEntries.length,
            removedBackups: backupEntries.filter((entry) => entry.isDirectory()).length,
            clearedActiveTransactionPointer: importEntries.some((entry) => entry.name === 'active-transaction.json'),
        };
    }

    private getCompletedTransactionRetentionMs() {
        const retentionDays = Number(process.env.SOLIDX_MODULE_PACKAGE_RETENTION_DAYS ?? 7);
        const safeDays = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 7;
        return safeDays * 24 * 60 * 60 * 1000;
    }

    private getPendingTransactionRetentionMs() {
        const retentionHours = Number(process.env.SOLIDX_MODULE_PACKAGE_PENDING_RETENTION_HOURS ?? 24);
        const safeHours = Number.isFinite(retentionHours) && retentionHours > 0 ? retentionHours : 24;
        return safeHours * 60 * 60 * 1000;
    }

    private async cleanupModulePackageTransactions() {
        const importsRoot = this.getModulePackageImportsRoot();
        const activePointer = await this.loadActiveTransactionPointer();
        const now = Date.now();

        try {
            await fs.mkdir(importsRoot, { recursive: true });
            const entries = await fs.readdir(importsRoot, { withFileTypes: true });

            for (const entry of entries) {
                if (!entry.isDirectory()) {
                    continue;
                }

                const transactionKey = entry.name;
                if (!/^[a-zA-Z0-9-]+$/.test(transactionKey)) {
                    continue;
                }

                const statusFilePath = this.getStatusFilePath(transactionKey);
                let transaction: ModulePackageStatusFile | null = null;

                try {
                    transaction = JSON.parse(await fs.readFile(statusFilePath, 'utf-8')) as ModulePackageStatusFile;
                } catch (error) {
                    continue;
                }

                const updatedAtMs = transaction.updatedAt ? new Date(transaction.updatedAt).getTime() : 0;
                const ageMs = updatedAtMs > 0 ? now - updatedAtMs : Number.MAX_SAFE_INTEGER;
                const isResumable = this.isResumableStatus(transaction.status);
                const maxAgeMs = isResumable
                    ? this.getPendingTransactionRetentionMs()
                    : this.getCompletedTransactionRetentionMs();
                const shouldDelete = ageMs > maxAgeMs;

                if (!shouldDelete) {
                    continue;
                }

                await fs.rm(path.join(importsRoot, transactionKey), { recursive: true, force: true });
                // A backup never outlives its transaction.
                await fs.rm(path.join(this.getModulePackageBackupsRoot(), transactionKey), { recursive: true, force: true });

                if (activePointer?.transactionKey === transactionKey) {
                    await fs.rm(this.getActiveTransactionFilePath(), { force: true });
                }
            }
        } catch (error) {
            this.logger.warn(`Failed to clean up module package transactions: ${String(error)}`);
        }
    }

    private async resolveLatestResumableTransaction(): Promise<ModulePackageStatusFile | null> {
        const activePointer = await this.loadActiveTransactionPointer();
        if (activePointer?.transactionKey) {
            try {
                const activeTransaction = await this.loadTransaction(activePointer.transactionKey);
                if (this.isResumableStatus(activeTransaction.status)) {
                    return activeTransaction;
                }

                await this.clearActiveTransactionIfMatches(activePointer.transactionKey);
            } catch (error) {
                await this.clearActiveTransactionIfMatches(activePointer.transactionKey);
            }
        }

        const importsRoot = this.getModulePackageImportsRoot();
        const candidates: ModulePackageStatusFile[] = [];

        try {
            const entries = await fs.readdir(importsRoot, { withFileTypes: true });

            for (const entry of entries) {
                if (!entry.isDirectory()) {
                    continue;
                }

                const transactionKey = entry.name;
                if (!/^[a-zA-Z0-9-]+$/.test(transactionKey)) {
                    continue;
                }

                try {
                    const transaction = await this.loadTransaction(transactionKey);
                    if (this.isResumableStatus(transaction.status)) {
                        candidates.push(transaction);
                    }
                } catch (error) {
                    continue;
                }
            }
        } catch (error) {
            return null;
        }

        candidates.sort((left, right) => {
            const leftUpdatedAt = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
            const rightUpdatedAt = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
            return rightUpdatedAt - leftUpdatedAt;
        });

        const latest = candidates[0] ?? null;
        if (latest) {
            await this.markActiveTransaction(latest.transactionKey);
        }
        return latest;
    }

    private toStatusResponse(transaction: ModulePackageStatusFile) {
        return {
            transactionKey: transaction.transactionKey,
            status: transaction.status,
            currentStep: transaction.currentStep,
            moduleName: transaction.moduleName,
            moduleDisplayName: transaction.moduleDisplayName,
            mode: transaction.mode,
            installedVersion: transaction.installedVersion,
            incomingVersion: transaction.incomingVersion,
            versionComparison: transaction.versionComparison,
            backup: transaction.backup,
            restoredFromBackup: transaction.restoredFromBackup,
            archiveFileName: transaction.archiveFileName,
            manifest: transaction.manifest,
            preview: transaction.preview,
            validation: transaction.validation,
            conflicts: transaction.conflicts,
            outputs: transaction.outputs,
            errorMessage: transaction.errorMessage,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt,
        };
    }

    private async buildExportManifest(moduleName: string, metadataDocument: any, stagingDir: string): Promise<ModulePackageManifest> {
        const expectedPaths = this.buildExpectedPaths(moduleName);
        const checksums = await this.computeDirectoryChecksums(stagingDir, ['manifest.json']);
        const userData = normalizeUserData(metadataDocument?.modulePackage?.userData);
        const dependencies = normalizePackageDependencies(metadataDocument?.modulePackage?.packageDependencies);
        const declaresModulePackage = hasUserData(userData) || !!dependencies;

        return {
            // 1.1 tells an older core, which would replace the whole module folder, to refuse the package.
            schemaVersion: declaresModulePackage ? '1.1' : ModulePackageService.SUPPORTED_SCHEMA_VERSION,
            packageType: ModulePackageService.SUPPORTED_PACKAGE_TYPE,
            exportedAt: new Date().toISOString(),
            generatedBy: {
                name: '@solidxai/core',
            },
            module: {
                name: moduleName,
                version: this.toValidVersion(metadataDocument?.moduleMetadata?.version) ?? undefined,
                displayName: metadataDocument?.moduleMetadata?.displayName,
                description: metadataDocument?.moduleMetadata?.description,
            },
            contents: expectedPaths,
            ...(hasUserData(userData) ? { userData } : {}),
            ...(dependencies ? { dependencies } : {}),
            postImport: {
                recommendedSteps: ['restart', 'build', 'seed'],
            },
            checksums,
        };
    }

    // The package never carries the developer's own user data: declared paths are dropped, protected metadata keys
    // are emptied, and the install record (which describes this project, not the package) is left out.
    private async removeUserDataFromStaging(stagingDir: string, moduleName: string, metadataDocument: any) {
        const userData = normalizeUserData(metadataDocument?.modulePackage?.userData);
        const stagedApi = path.join(stagingDir, 'solid-api', 'src', moduleName);
        const stagedUi = path.join(stagingDir, 'solid-ui', 'src', moduleName);

        for (const entry of userData.solidApiPaths) {
            await fs.rm(path.join(stagedApi, entry), { recursive: true, force: true });
        }
        for (const entry of userData.solidUiPaths) {
            await fs.rm(path.join(stagedUi, entry), { recursive: true, force: true });
        }
        await fs.rm(path.join(stagedApi, INSTALL_RECORD_FILE), { force: true });

        if (userData.metadataKeys.length > 0) {
            const stagedMetadata = path.join(stagingDir, this.buildExpectedPaths(moduleName).metadataPath);
            const document = JSON.parse(await fs.readFile(stagedMetadata, 'utf-8'));
            await fs.writeFile(stagedMetadata, JSON.stringify(withEmptiedMetadataKeys(document, userData.metadataKeys), null, 2));
        }
    }

    // The user data to protect on an update: what the installed module declares plus what the incoming package declares.
    // The incoming side covers installs from before the module declared anything.
    private async resolveProtectedUserData(moduleName: string, manifest: ModulePackageManifest | null, incomingMetadata: any): Promise<ModulePackageUserData> {
        const installedMetadata = await this.readInstalledMetadata(moduleName);
        return mergeUserData(
            normalizeUserData(installedMetadata?.modulePackage?.userData),
            normalizeUserData(manifest?.userData),
            normalizeUserData(incomingMetadata?.modulePackage?.userData),
        );
    }

    private async readInstalledMetadata(moduleName: string): Promise<any | null> {
        const metadataFilePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        return this.readJsonFile(metadataFilePath);
    }

    private async readJsonFile(filePath: string): Promise<any | null> {
        try {
            return JSON.parse(await fs.readFile(filePath, 'utf-8'));
        } catch {
            return null;
        }
    }

    private async listModuleFiles(moduleName: string, apiDir: string | null, uiDir: string | null) {
        return {
            ...(await listPackageFiles(`solid-api/src/${moduleName}`, apiDir)),
            ...(await listPackageFiles(`solid-ui/src/${moduleName}`, uiDir)),
        };
    }

    private async planImportSync(moduleName: string, extractRoot: string, userData: ModulePackageUserData): Promise<SyncPlan> {
        const apiTarget = this.getSolidApiModuleTargetPath(moduleName);
        return planModuleSync({
            moduleName,
            incoming: await this.listModuleFiles(moduleName, path.join(extractRoot, 'solid-api', 'src', moduleName), path.join(extractRoot, 'solid-ui', 'src', moduleName)),
            current: await this.listModuleFiles(moduleName, apiTarget, this.getSolidUiModuleTargetPath(moduleName)),
            record: await readInstallRecord(apiTarget),
            userData,
            metadataPackagePath: this.buildExpectedPaths(moduleName).metadataPath,
        });
    }

    private summarizeSyncPlan(plan: SyncPlan, userData: ModulePackageUserData): ModulePackageFileSyncSummary {
        return {
            legacyInstall: plan.legacyInstall,
            keptUserFiles: plan.keptUserFiles.length,
            keptOtherFiles: plan.keptOther,
            removedUpstream: plan.remove,
            keptModifiedFiles: plan.keptModified,
            locallyModifiedReplaced: plan.replacedModified,
            droppedProtected: plan.droppedProtected,
            protectedMetadataKeys: userData.metadataKeys,
        };
    }

    private async dependencyAppDirs() {
        const dirs: Array<{ label: 'solidApi' | 'solidUi'; name: string; dir: string }> = [
            { label: 'solidApi', name: 'solid-api', dir: this.getSolidApiRoot() },
            { label: 'solidUi', name: 'solid-ui', dir: this.getSolidUiRoot() },
        ];
        const present = [];
        for (const entry of dirs) {
            if (await this.pathExists(path.join(entry.dir, 'package.json'))) {
                present.push(entry);
            }
        }
        return present;
    }

    private async buildDependencyPreview(manifest: ModulePackageManifest | null): Promise<ModulePackageDependencyPreview | null> {
        const declared = normalizePackageDependencies(manifest?.dependencies);
        if (!declared) {
            return null;
        }

        const preview: ModulePackageDependencyPreview = { solidApi: [], solidUi: [], prerequisites: declared.prerequisites, missingCount: 0, mismatchCount: 0, installCommands: [] };
        for (const { label, name, dir } of await this.dependencyAppDirs()) {
            const statuses = await checkDependencies(dir, declared[label]);
            preview[label] = statuses;
            preview.missingCount += statuses.filter((status) => status.state === 'missing').length;
            preview.mismatchCount += statuses.filter((status) => status.state === 'mismatch').length;
            const missing = statuses.filter((status) => status.state === 'missing').map((status) => `${status.name}@${status.range}`);
            if (missing.length > 0) {
                const { command, args } = await buildInstallCommand(dir, missing);
                preview.installCommands.push(`cd ${name} && ${command} ${args.join(' ')}`);
            }
        }
        return preview;
    }

    // Installs the declared packages the host app lacks. Runs before any module file is placed, so a failure leaves the
    // project as it was and the import can be retried, or retried with skipDependencyInstall once the packages are installed by hand.
    private async installDeclaredDependencies(manifest: ModulePackageManifest | null, skip: boolean): Promise<string[]> {
        const declared = normalizePackageDependencies(manifest?.dependencies);
        if (!declared) {
            return [];
        }

        const outputs: string[] = [];
        for (const { label, name, dir } of await this.dependencyAppDirs()) {
            const statuses = await checkDependencies(dir, declared[label]);
            for (const status of statuses.filter((entry) => entry.state === 'mismatch')) {
                outputs.push(`${name}: ${status.name} ${status.installedVersion} does not satisfy ${status.range}; left as it is.`);
            }

            const missing = statuses.filter((status) => status.state === 'missing').map((status) => `${status.name}@${status.range}`);
            if (missing.length === 0) {
                continue;
            }

            const { command, args } = await buildInstallCommand(dir, missing);
            const commandLine = `${command} ${args.join(' ')}`;
            if (skip) {
                outputs.push(`${name}: skipped installing ${missing.join(', ')}. Run in ${dir}: ${commandLine}`);
                continue;
            }

            try {
                const output = await this.commandService.executeCommandWithArgs({ command, args, cwd: dir });
                outputs.push(`${name}: installed ${missing.join(', ')}\n${output}`.trim());
            } catch (error: any) {
                throw new BadRequestException({
                    message: `Installing ${missing.join(', ')} in ${name} failed. Nothing was imported. Retry, or install them yourself (${commandLine}) and confirm with skipDependencyInstall.`,
                    output: error?.message ?? '',
                });
            }
        }
        return outputs;
    }

    private async computeDirectoryChecksums(rootDir: string, excludedRelativePaths: string[] = []): Promise<Record<string, string>> {
        const excludedPaths = new Set(excludedRelativePaths.map((entry) => entry.replace(/\\/g, '/')));
        const filePaths = await this.collectFilePathsRecursively(rootDir);
        const checksums: Record<string, string> = {};

        for (const filePath of filePaths) {
            const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
            if (excludedPaths.has(relativePath)) {
                continue;
            }

            checksums[relativePath] = await this.computeSha256(filePath);
        }

        return checksums;
    }

    private async collectFilePathsRecursively(rootDir: string): Promise<string[]> {
        const entries = await fs.readdir(rootDir, { withFileTypes: true });
        const nestedPaths = await Promise.all(entries.map(async (entry) => {
            const entryPath = path.join(rootDir, entry.name);
            if (entry.isDirectory()) {
                return this.collectFilePathsRecursively(entryPath);
            }

            return [entryPath];
        }));

        return nestedPaths.flat();
    }

    private async createArchiveFromDirectory(sourceDir: string, archiveFilePath: string): Promise<void> {
        await fs.mkdir(path.dirname(archiveFilePath), { recursive: true });

        await new Promise<void>((resolve, reject) => {
            const output = createWriteStream(archiveFilePath);
            const archive = archiver('zip', {
                zlib: { level: 9 },
            });

            const rejectOnce = (error: Error) => {
                output.destroy();
                reject(error);
            };

            output.on('close', () => resolve());
            output.on('error', rejectOnce);
            archive.on('warning', rejectOnce);
            archive.on('error', rejectOnce);

            archive.pipe(output);
            archive.directory(sourceDir, false);
            void archive.finalize();
        });
    }

    private async computeSha256(filePath: string): Promise<string> {
        const fileBuffer = await fs.readFile(filePath);
        return createHash('sha256').update(fileBuffer).digest('hex');
    }
}
