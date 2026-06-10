import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DisallowInProduction } from 'src/decorators/disallow-in-production.decorator';
import { ConfirmModulePackageImportDto } from 'src/dtos/confirm-module-package-import.dto';
import { RunModulePackageBuildDto } from 'src/dtos/run-module-package-build.dto';
import { RunModulePackageSeedDto } from 'src/dtos/run-module-package-seed.dto';
import { CommandService } from 'src/helpers/command.service';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
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
        displayName?: string;
        description?: string;
    };
    contents: {
        metadataPath: string;
        apiModulePath: string;
        uiModulePath: string;
    };
    compatibility?: Record<string, unknown>;
    postImport?: Record<string, unknown>;
    checksums?: Record<string, string>;
};

type ValidationPayload = {
    valid: boolean;
    errors: string[];
    warnings: string[];
};

type PreviewPayload = {
    module: {
        name: string;
        displayName?: string;
        description?: string;
    };
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
    outputs: {
        import: string | null;
        build: string | null;
        seed: string | null;
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
    completed = 'completed',
    failed = 'failed',
}

@Injectable()
export class ModulePackageService {
    private readonly logger = new Logger(ModulePackageService.name);
    private static readonly SUPPORTED_SCHEMA_VERSION = '1.0';
    private static readonly SUPPORTED_PACKAGE_TYPE = 'solidx-module';

    constructor(
        private readonly commandService: CommandService,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    ) { }

    @DisallowInProduction()
    async validateUpload(file: Express.Multer.File) {
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
            outputs: {
                import: null,
                build: null,
                seed: null,
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
    async exportModulePackage(moduleNameInput: string): Promise<ModulePackageExportFile> {
        const moduleName = (moduleNameInput ?? '').trim();
        if (!moduleName) {
            throw new BadRequestException('A module name is required to export a module package.');
        }

        const expectedPaths = this.buildExpectedPaths(moduleName);
        const solidApiModulePath = this.getSolidApiModuleTargetPath(moduleName);
        const solidUiModulePath = this.getSolidUiModuleTargetPath(moduleName);
        const metadataFilePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);

        await this.assertPathExists(solidApiModulePath, 'solid-api module path');
        await this.assertPathExists(solidUiModulePath, 'solid-ui module path');
        await this.assertPathExists(metadataFilePath, 'module metadata file');

        const metadataDocument = this.parseMetadataDocument(
            await fs.readFile(metadataFilePath, 'utf-8'),
            [],
        );

        const transactionKey = uuidv4();
        const exportRoot = path.join(this.getModulePackageExportsRoot(), transactionKey);
        const stagingDir = path.join(exportRoot, 'staging');
        const archiveFileName = `${moduleName}.sldx`;
        const archiveFilePath = path.join(exportRoot, archiveFileName);

        await fs.mkdir(path.join(stagingDir, 'solid-api', 'src'), { recursive: true });
        await fs.mkdir(path.join(stagingDir, 'solid-ui', 'src'), { recursive: true });

        await fs.cp(solidApiModulePath, path.join(stagingDir, 'solid-api', 'src', moduleName), { recursive: true });
        await fs.cp(solidUiModulePath, path.join(stagingDir, 'solid-ui', 'src', moduleName), { recursive: true });

        const manifest = await this.buildExportManifest(moduleName, metadataDocument);
        await fs.writeFile(
            path.join(stagingDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2),
            'utf-8',
        );

        await this.commandService.executeCommandWithArgs({
            command: 'zip',
            args: ['-rq', archiveFilePath, '.'],
            cwd: stagingDir,
        });

        return {
            fileName: archiveFileName,
            filePath: archiveFilePath,
            mimeType: 'application/octet-stream',
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

        const overwriteExisting = dto.overwriteExisting ?? false;
        if (preview.conflicts.length > 0 && !overwriteExisting) {
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
            const extractRoot = transaction.archiveRootPrefix
                ? path.join(transaction.extractDirPath as string, transaction.archiveRootPrefix.replace(/\/$/, ''))
                : transaction.extractDirPath as string;
            const solidApiSource = path.join(extractRoot, 'solid-api', 'src', moduleName);
            const solidUiSource = path.join(extractRoot, 'solid-ui', 'src', moduleName);

            await this.assertPathExists(solidApiSource, 'solid-api module source');
            await this.assertPathExists(solidUiSource, 'solid-ui module source');

            if (overwriteExisting) {
                await fs.rm(solidApiTarget, { recursive: true, force: true });
                await fs.rm(solidUiTarget, { recursive: true, force: true });
            }

            await fs.mkdir(path.dirname(solidApiTarget), { recursive: true });
            await fs.mkdir(path.dirname(solidUiTarget), { recursive: true });

            await fs.cp(solidApiSource, solidApiTarget, { recursive: true, force: overwriteExisting });
            await fs.cp(solidUiSource, solidUiTarget, { recursive: true, force: overwriteExisting });

            if (transaction.extractDirPath) {
                await fs.rm(transaction.extractDirPath, { recursive: true, force: true });
                transaction.extractDirPath = null;
            }

            transaction.status = ModulePackageStatus.awaiting_restart;
            transaction.currentStep = 'restart';
            transaction.outputs.import = [
                `Placed solid-api module at ${solidApiTarget}`,
                `Placed solid-ui module at ${solidUiTarget}`,
                `Metadata file placed at ${preview.requiredPaths.metadataPath}`,
            ].join('\n');
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
            const output = await this.commandService.executeCommandWithArgs({
                command: 'npx',
                args: ['-y', '@solidxai/solidctl@latest', 'seed', '--modules-to-seed', moduleName],
                cwd: this.getProjectRoot(),
            });
            transaction.status = ModulePackageStatus.completed;
            transaction.currentStep = 'done';
            transaction.outputs.seed = [
                `solidctl seed --modules-to-seed ${moduleName} [success]`,
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
                },
            };
        }

        if (manifest.packageType !== ModulePackageService.SUPPORTED_PACKAGE_TYPE) {
            validationErrors.push(`manifest.json packageType must be "${ModulePackageService.SUPPORTED_PACKAGE_TYPE}".`);
        }
        if (manifest.schemaVersion !== ModulePackageService.SUPPORTED_SCHEMA_VERSION) {
            validationErrors.push(`manifest.json schemaVersion must be "${ModulePackageService.SUPPORTED_SCHEMA_VERSION}".`);
        }
        if (!manifest.module?.name) {
            validationErrors.push('manifest.json module.name is required.');
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
            validationWarnings.push('The target module already exists locally and will require overwrite confirmation.');
        }

        const validation: ValidationPayload = {
            valid: validationErrors.length === 0,
            errors: validationErrors,
            warnings: validationWarnings,
        };

        const preview: PreviewPayload = {
            module: manifest.module,
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

        return JSON.parse(await fs.readFile(statusFilePath, 'utf-8')) as ModulePackageStatusFile;
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
        ].includes(status as ModulePackageStatus);
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

    private async buildExportManifest(moduleName: string, metadataDocument: any): Promise<ModulePackageManifest> {
        const expectedPaths = this.buildExpectedPaths(moduleName);
        const stagingPaths = [
            expectedPaths.metadataPath,
            expectedPaths.apiModulePath,
            expectedPaths.uiModulePath,
        ];
        const checksums: Record<string, string> = {};

        for (const relativePath of stagingPaths) {
            const absolutePath = path.join(this.getSolidApiRoot(), '..', relativePath);
            checksums[relativePath] = await this.computeSha256(absolutePath);
        }

        return {
            schemaVersion: ModulePackageService.SUPPORTED_SCHEMA_VERSION,
            packageType: ModulePackageService.SUPPORTED_PACKAGE_TYPE,
            exportedAt: new Date().toISOString(),
            generatedBy: {
                name: '@solidxai/core',
            },
            module: {
                name: moduleName,
                displayName: metadataDocument?.moduleMetadata?.displayName,
                description: metadataDocument?.moduleMetadata?.description,
            },
            contents: expectedPaths,
            postImport: {
                recommendedSteps: ['restart', 'build', 'seed'],
            },
            checksums,
        };
    }

    private async computeSha256(filePath: string): Promise<string> {
        const fileBuffer = await fs.readFile(filePath);
        return createHash('sha256').update(fileBuffer).digest('hex');
    }
}
