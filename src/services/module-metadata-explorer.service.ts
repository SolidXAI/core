import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DisallowInProduction } from 'src/decorators/disallow-in-production.decorator';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { MetadataExplorerReferencesQueryDto } from '../dtos/metadata-explorer-references-query.dto';
import { MetadataExplorerSearchQueryDto } from '../dtos/metadata-explorer-search-query.dto';
import { MetadataExplorerWriteDto } from '../dtos/metadata-explorer-write.dto';

type MetadataExplorerSectionType = 'object' | 'array';

type MetadataExplorerSectionDefinition = {
    key: string;
    title: string;
    jsonPath: string;
    type: MetadataExplorerSectionType;
    description: string;
};

type MetadataValidationIssue = {
    path: string;
    message: string;
    severity: 'error' | 'warning';
};

type MetadataSearchMatch = {
    path: string;
    sectionKey: string | null;
    matchType: 'key' | 'value';
    valueType: string;
    preview: string;
};

const SECTION_DEFINITIONS: MetadataExplorerSectionDefinition[] = [
    { key: 'module', title: 'Module', jsonPath: 'moduleMetadata', type: 'object', description: 'Top-level module metadata excluding nested models.' },
    { key: 'models', title: 'Models', jsonPath: 'moduleMetadata.models', type: 'array', description: 'Model metadata definitions for the module.' },
    { key: 'roles', title: 'Roles', jsonPath: 'roles', type: 'array', description: 'Role metadata definitions.' },
    { key: 'users', title: 'Users', jsonPath: 'users', type: 'array', description: 'Seed users and user-role assignments.' },
    { key: 'permissions', title: 'Permissions', jsonPath: 'permissions', type: 'array', description: 'Permission declarations and explicit additions.' },
    { key: 'actions', title: 'Actions', jsonPath: 'actions', type: 'array', description: 'Action metadata definitions.' },
    { key: 'menus', title: 'Menus', jsonPath: 'menus', type: 'array', description: 'Menu item metadata definitions.' },
    { key: 'views', title: 'Views', jsonPath: 'views', type: 'array', description: 'List, form, kanban, tree, and related view metadata.' },
    { key: 'emailTemplates', title: 'Email Templates', jsonPath: 'emailTemplates', type: 'array', description: 'Email template metadata.' },
    { key: 'smsTemplates', title: 'SMS Templates', jsonPath: 'smsTemplates', type: 'array', description: 'SMS template metadata.' },
    { key: 'mediaStorageProviders', title: 'Media Storage Providers', jsonPath: 'mediaStorageProviders', type: 'array', description: 'Configured media storage providers.' },
    { key: 'savedFilters', title: 'Saved Filters', jsonPath: 'savedFilters', type: 'array', description: 'Saved filter definitions.' },
    { key: 'securityRules', title: 'Security Rules', jsonPath: 'securityRules', type: 'array', description: 'Security rule definitions.' },
    { key: 'listOfValues', title: 'List Of Values', jsonPath: 'listOfValues', type: 'array', description: 'List of values entries.' },
    { key: 'dashboards', title: 'Dashboards', jsonPath: 'dashboards', type: 'array', description: 'Dashboard metadata definitions.' },
    { key: 'testing', title: 'Testing', jsonPath: 'testing', type: 'object', description: 'Testing roles, users, specs, and scenarios.' },
    { key: 'scheduledJobs', title: 'Scheduled Jobs', jsonPath: 'scheduledJobs', type: 'array', description: 'Scheduled job metadata definitions.' },
    { key: 'modelSequences', title: 'Model Sequences', jsonPath: 'modelSequences', type: 'array', description: 'Model sequence definitions.' },
];

@Injectable()
export class ModuleMetadataExplorerService {
    private readonly logger = new Logger(ModuleMetadataExplorerService.name);

    constructor(
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    ) { }

    /**
     * Input: module name string.
     * Output: explorer manifest containing file details, section summaries, and document validation state.
     * Logic: loads the module metadata JSON, computes section-level summary information, and returns
     * the high-level descriptor the explorer UI can use to render navigation and status badges.
     */
    async getManifest(moduleName: string) {
        const { document, filePath, stats } = await this.loadMetadataDocument(moduleName);
        const validation = this.validateDocumentValue(document);

        const sections = SECTION_DEFINITIONS.map((definition) => {
            const value = this.getValueAtPath(document, definition.jsonPath);
            return {
                ...definition,
                exists: value !== undefined,
                itemCount: Array.isArray(value) ? value.length : undefined,
                nodeCount: this.countNodes(value),
                preview: this.buildPreview(value, 96),
            };
        });

        return {
            moduleName,
            filePath,
            lastModifiedAt: stats.mtime.toISOString(),
            sections,
            validation,
        };
    }

    /**
     * Input: module name string.
     * Output: full metadata document payload with file metadata and validation results.
     * Logic: reads the resolved module metadata JSON from disk and returns it as the canonical
     * document payload for full-document editing scenarios.
     */
    async getDocument(moduleName: string) {
        const { document, filePath, stats } = await this.loadMetadataDocument(moduleName);
        return {
            moduleName,
            filePath,
            lastModifiedAt: stats.mtime.toISOString(),
            value: document,
            validation: this.validateDocumentValue(document),
        };
    }

    /**
     * Input: module name string and a DTO containing the replacement JSON document in `value`.
     * Output: refreshed full document payload after a successful write.
     * Logic: validates the incoming JSON document at a coarse structural level, writes it back to
     * the resolved metadata file, and then reloads the saved document to return the persisted state.
     */
    @DisallowInProduction()
    async updateDocument(moduleName: string, dto: MetadataExplorerWriteDto) {
        this.assertValueProvided(dto?.value);
        const validation = this.validateDocumentValue(dto.value);
        if (!validation.valid) {
            throw new BadRequestException(validation);
        }

        const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        await this.writeMetadataDocument(filePath, dto.value);
        return this.getDocument(moduleName);
    }

    /**
     * Input: module name string and an optional DTO containing a document candidate in `value`.
     * Output: validation result object with `valid` flag and issue list.
     * Logic: validates either the supplied document candidate or the currently persisted metadata
     * file without mutating anything, so the UI can perform pre-save checks.
     */
    async validateDocument(moduleName: string, dto?: MetadataExplorerWriteDto) {
        const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        const value = dto && Object.prototype.hasOwnProperty.call(dto, 'value')
            ? dto.value
            : (await this.loadMetadataDocument(moduleName)).document;
        return {
            moduleName,
            filePath,
            ...this.validateDocumentValue(value),
        };
    }

    /**
     * Input: module name string and a section key such as `models` or `views`.
     * Output: section payload containing metadata about the section, its JSON value, and validation.
     * Logic: resolves the section definition, extracts that fragment from the full metadata document,
     * and returns the section in a UI-friendly envelope.
     */
    async getSection(moduleName: string, sectionKey: string) {
        const definition = this.getSectionDefinition(sectionKey);
        const { document, filePath, stats } = await this.loadMetadataDocument(moduleName);
        const value = this.getValueAtPath(document, definition.jsonPath);

        return {
            moduleName,
            filePath,
            lastModifiedAt: stats.mtime.toISOString(),
            section: this.buildSectionResponse(definition, value),
            validation: this.validateSectionValue(definition, value),
        };
    }

    /**
     * Input: module name string, section key, and a DTO containing the replacement section JSON in `value`.
     * Output: refreshed section payload after the section is written back into the document.
     * Logic: validates the incoming section shape, merges it into the current document at the
     * configured JSON path, validates the resulting document, writes the file, and reloads the section.
     */
    @DisallowInProduction()
    async updateSection(moduleName: string, sectionKey: string, dto: MetadataExplorerWriteDto) {
        this.assertValueProvided(dto?.value);
        const definition = this.getSectionDefinition(sectionKey);
        const sectionValidation = this.validateSectionValue(definition, dto.value);
        if (!sectionValidation.valid) {
            throw new BadRequestException(sectionValidation);
        }

        const { document, filePath } = await this.loadMetadataDocument(moduleName);
        this.setValueAtPath(document, definition.jsonPath, dto.value);

        const documentValidation = this.validateDocumentValue(document);
        if (!documentValidation.valid) {
            throw new BadRequestException(documentValidation);
        }

        await this.writeMetadataDocument(filePath, document);
        return this.getSection(moduleName, sectionKey);
    }

    /**
     * Input: module name string, section key, and an optional DTO containing a section candidate in `value`.
     * Output: validation result scoped to that section.
     * Logic: validates either the supplied section candidate or the persisted section value against
     * the configured section definition without performing any writes.
     */
    async validateSection(moduleName: string, sectionKey: string, dto?: MetadataExplorerWriteDto) {
        const definition = this.getSectionDefinition(sectionKey);
        const value = dto && Object.prototype.hasOwnProperty.call(dto, 'value')
            ? dto.value
            : this.getValueAtPath((await this.loadMetadataDocument(moduleName)).document, definition.jsonPath);

        return {
            moduleName,
            sectionKey,
            section: {
                key: definition.key,
                title: definition.title,
                jsonPath: definition.jsonPath,
                type: definition.type,
            },
            ...this.validateSectionValue(definition, value),
        };
    }

    /**
     * Input: module name string plus search query DTO with query text, optional section scope,
     * exact-match toggle, preview length, limit, and offset.
     * Output: paginated list of key/value matches with JSON paths and section attribution.
     * Logic: loads the document, optionally narrows the search root to a specific section, and then
     * recursively scans keys and primitive values for textual matches.
     */
    async search(moduleName: string, query: MetadataExplorerSearchQueryDto) {
        const needle = `${query?.query ?? ''}`.trim();
        if (!needle) {
            throw new BadRequestException('Search query is required.');
        }

        const { document } = await this.loadMetadataDocument(moduleName);
        const targetSection = query?.sectionKey ? this.getSectionDefinition(query.sectionKey) : null;
        const searchRoot = targetSection ? this.getValueAtPath(document, targetSection.jsonPath) : document;
        const rootPath = targetSection ? targetSection.jsonPath : '';
        const limit = query?.limit ?? 10;
        const offset = query?.offset ?? 0;
        const matches = this.collectMatches(searchRoot, rootPath, {
            needle,
            exact: query?.exact ?? false,
            limit,
            offset,
            previewLength: query?.previewLength ?? 120,
            matchKeys: true,
            matchValues: true,
        });

        return {
            moduleName,
            query: needle,
            sectionKey: targetSection?.key ?? null,
            meta: {
                totalMatches: matches.total,
                returned: matches.items.length,
                limit,
                offset,
            },
            matches: matches.items,
        };
    }

    /**
     * Input: module name string plus reference-query DTO with needle, optional section scope,
     * match strategy flags, exclusion path, limit, and offset.
     * Output: paginated list of reference-like matches across keys and/or values.
     * Logic: performs the same recursive traversal engine as search, but with defaults tuned for
     * exact reference lookups and optional exclusion of the source path being inspected.
     */
    async findReferences(moduleName: string, query: MetadataExplorerReferencesQueryDto) {
        const needle = `${query?.needle ?? ''}`.trim();
        if (!needle) {
            throw new BadRequestException('Reference needle is required.');
        }

        const { document } = await this.loadMetadataDocument(moduleName);
        const targetSection = query?.sectionKey ? this.getSectionDefinition(query.sectionKey) : null;
        const searchRoot = targetSection ? this.getValueAtPath(document, targetSection.jsonPath) : document;
        const rootPath = targetSection ? targetSection.jsonPath : '';
        const limit = query?.limit ?? 10;
        const offset = query?.offset ?? 0;
        const matches = this.collectMatches(searchRoot, rootPath, {
            needle,
            exact: query?.exact ?? true,
            limit,
            offset,
            previewLength: 140,
            matchKeys: query?.matchKeys ?? true,
            matchValues: query?.matchValues ?? true,
            excludePath: query?.excludePath,
        });

        return {
            moduleName,
            needle,
            sectionKey: targetSection?.key ?? null,
            meta: {
                totalMatches: matches.total,
                returned: matches.items.length,
                limit,
                offset,
            },
            matches: matches.items,
        };
    }

    /**
     * Input: module name string.
     * Output: parsed JSON document, resolved file path, and file stats.
     * Logic: resolves the module metadata file location, reads it from disk, parses JSON, and maps
     * common file and syntax errors into explorer-specific HTTP exceptions.
     */
    private async loadMetadataDocument(moduleName: string) {
        const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        if (!filePath) {
            throw new NotFoundException(`Unable to resolve metadata file for module: ${moduleName}`);
        }

        try {
            const [raw, stats] = await Promise.all([
                fs.readFile(filePath, 'utf-8'),
                fs.stat(filePath),
            ]);
            const document = JSON.parse(raw);
            return { document, filePath, stats };
        } catch (error: any) {
            if (error?.code === 'ENOENT') {
                throw new NotFoundException(`Metadata file not found for module: ${moduleName}`);
            }

            if (error instanceof SyntaxError) {
                throw new BadRequestException(`Metadata file for module ${moduleName} contains invalid JSON.`);
            }

            this.logger.error(`Failed to load metadata for module ${moduleName}`, error);
            throw error;
        }
    }

    /**
     * Input: absolute metadata file path and the JSON document value to persist.
     * Output: none.
     * Logic: ensures the target directory exists and writes a formatted JSON file with a trailing
     * newline so the explorer remains the canonical persistence path for metadata edits.
     */
    private async writeMetadataDocument(filePath: string, document: any) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf-8');
    }

    /**
     * Input: section key string.
     * Output: matching section definition object.
     * Logic: looks up the fixed explorer section registry and throws a 404 when the caller asks for
     * a section the explorer does not expose.
     */
    private getSectionDefinition(sectionKey: string): MetadataExplorerSectionDefinition {
        const definition = SECTION_DEFINITIONS.find((item) => item.key === sectionKey);
        if (!definition) {
            throw new NotFoundException(`Metadata explorer section not found: ${sectionKey}`);
        }
        return definition;
    }

    /**
     * Input: section definition and extracted section JSON value.
     * Output: normalized section response payload for the API.
     * Logic: enriches the raw section value with descriptive metadata, existence flags, counts, and
     * the original JSON so the UI can render a section panel without extra computation.
     */
    private buildSectionResponse(definition: MetadataExplorerSectionDefinition, value: any) {
        return {
            key: definition.key,
            title: definition.title,
            jsonPath: definition.jsonPath,
            type: definition.type,
            description: definition.description,
            exists: value !== undefined,
            itemCount: Array.isArray(value) ? value.length : undefined,
            nodeCount: this.countNodes(value),
            value,
        };
    }

    /**
     * Input: candidate full metadata document.
     * Output: validation result containing a boolean validity flag and issue list.
     * Logic: performs coarse structural checks for the overall document contract and also validates
     * each known explorer section against its expected container type.
     */
    private validateDocumentValue(document: any) {
        const issues: MetadataValidationIssue[] = [];

        if (!document || typeof document !== 'object' || Array.isArray(document)) {
            issues.push({
                path: '',
                message: 'Metadata document must be a JSON object.',
                severity: 'error',
            });
        }

        const moduleMetadata = document?.moduleMetadata;
        if (!moduleMetadata || typeof moduleMetadata !== 'object' || Array.isArray(moduleMetadata)) {
            issues.push({
                path: 'moduleMetadata',
                message: 'moduleMetadata must be present as an object.',
                severity: 'error',
            });
        }

        if (moduleMetadata && !Array.isArray(moduleMetadata.models)) {
            issues.push({
                path: 'moduleMetadata.models',
                message: 'moduleMetadata.models must be an array.',
                severity: 'error',
            });
        }

        for (const definition of SECTION_DEFINITIONS) {
            const sectionValue = this.getValueAtPath(document, definition.jsonPath);
            const sectionValidation = this.validateSectionValue(definition, sectionValue, true);
            issues.push(...sectionValidation.issues);
        }

        return {
            valid: issues.every((issue) => issue.severity !== 'error'),
            issues,
        };
    }

    /**
     * Input: section definition, candidate section value, and optional allow-undefined toggle.
     * Output: validation result for that section.
     * Logic: checks whether a section is present when required and whether it matches the configured
     * array or object shape expected by the explorer contract.
     */
    private validateSectionValue(
        definition: MetadataExplorerSectionDefinition,
        value: any,
        allowUndefined = false,
    ) {
        const issues: MetadataValidationIssue[] = [];

        if (value === undefined) {
            if (!allowUndefined) {
                issues.push({
                    path: definition.jsonPath,
                    message: `${definition.title} is missing from the metadata document.`,
                    severity: 'error',
                });
            }
            return {
                valid: issues.every((issue) => issue.severity !== 'error'),
                issues,
            };
        }

        const isArray = Array.isArray(value);
        if (definition.type === 'array' && !isArray) {
            issues.push({
                path: definition.jsonPath,
                message: `${definition.title} must be an array.`,
                severity: 'error',
            });
        }

        if (definition.type === 'object' && (value === null || typeof value !== 'object' || isArray)) {
            issues.push({
                path: definition.jsonPath,
                message: `${definition.title} must be an object.`,
                severity: 'error',
            });
        }

        return {
            valid: issues.every((issue) => issue.severity !== 'error'),
            issues,
        };
    }

    /**
     * Input: source object and dot-delimited JSON path.
     * Output: value found at that path, or undefined if any segment is missing.
     * Logic: walks the object graph one segment at a time and safely stops when an intermediate node
     * does not exist.
     */
    private getValueAtPath(source: any, jsonPath: string): any {
        if (!jsonPath) return source;
        return jsonPath.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), source);
    }

    /**
     * Input: target object, dot-delimited JSON path, and replacement value.
     * Output: none.
     * Logic: creates missing object containers along the path as needed and then assigns the final
     * value at the terminal segment.
     */
    private setValueAtPath(target: any, jsonPath: string, value: any) {
        const parts = jsonPath.split('.');
        let current = target;

        for (let index = 0; index < parts.length - 1; index++) {
            const part = parts[index];
            if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
                current[part] = {};
            }
            current = current[part];
        }

        current[parts[parts.length - 1]] = value;
    }

    /**
     * Input: any JSON value.
     * Output: integer node count representing the size of that subtree.
     * Logic: recursively counts container nodes and primitive leaves so the explorer can show rough
     * section complexity metrics in manifests and section responses.
     */
    private countNodes(value: any): number {
        if (value === undefined || value === null) return 0;
        if (Array.isArray(value)) {
            return value.reduce<number>((sum, item) => sum + this.countNodes(item), 1);
        }
        if (typeof value === 'object') {
            return Object.values(value).reduce<number>((sum, item) => sum + this.countNodes(item), 1);
        }
        return 1;
    }

    /**
     * Input: any JSON value and a maximum preview length.
     * Output: string preview suitable for manifest/search display.
     * Logic: converts the value to a string representation and truncates it to a bounded length for
     * compact display in explorer summaries.
     */
    private buildPreview(value: any, maxLength: number): string {
        if (value === undefined) return '';

        const normalized = typeof value === 'string'
            ? value
            : JSON.stringify(value);

        if (!normalized) return '';
        return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
    }

    /**
     * Input: search root value, its root JSON path, and traversal options.
     * Output: total match count plus the paginated slice of matches requested by the caller.
     * Logic: recursively traverses arrays, objects, and primitives, recording key and/or value
     * matches together with their JSON paths and preview text.
     */
    private collectMatches(
        root: any,
        rootPath: string,
        opts: {
            needle: string;
            exact: boolean;
            limit: number;
            offset: number;
            previewLength: number;
            matchKeys: boolean;
            matchValues: boolean;
            excludePath?: string;
        },
    ) {
        const results: MetadataSearchMatch[] = [];
        const normalizedNeedle = opts.exact ? opts.needle : opts.needle.toLowerCase();

        const visit = (value: any, currentPath: string) => {
            if (value === undefined) return;

            if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    visit(item, this.joinPath(currentPath, `${index}`));
                });
                return;
            }

            if (value && typeof value === 'object') {
                Object.entries(value).forEach(([key, child]) => {
                    const childPath = this.joinPath(currentPath, key);

                    if (opts.matchKeys && this.matchesNeedle(key, normalizedNeedle, opts.exact) && childPath !== opts.excludePath) {
                        results.push({
                            path: childPath,
                            sectionKey: this.resolveSectionKey(childPath),
                            matchType: 'key',
                            valueType: 'key',
                            preview: this.buildPreview(child, opts.previewLength),
                        });
                    }

                    visit(child, childPath);
                });
                return;
            }

            if (!opts.matchValues) return;
            const comparable = value == null ? '' : `${value}`;
            if (this.matchesNeedle(comparable, normalizedNeedle, opts.exact) && currentPath !== opts.excludePath) {
                results.push({
                    path: currentPath,
                    sectionKey: this.resolveSectionKey(currentPath),
                    matchType: 'value',
                    valueType: typeof value,
                    preview: this.buildPreview(value, opts.previewLength),
                });
            }
        };

        visit(root, rootPath);

        return {
            total: results.length,
            items: results.slice(opts.offset, opts.offset + opts.limit),
        };
    }

    /**
     * Input: candidate string value, normalized search needle, and exact-match flag.
     * Output: boolean indicating whether the value matches the search.
     * Logic: performs either exact comparison or case-insensitive containment matching, depending on
     * the caller's intent.
     */
    private matchesNeedle(value: string, normalizedNeedle: string, exact: boolean): boolean {
        if (exact) {
            return value === normalizedNeedle;
        }
        return value.toLowerCase().includes(normalizedNeedle);
    }

    /**
     * Input: JSON path string from a match result.
     * Output: matching explorer section key or null when the path is outside known sections.
     * Logic: finds the deepest section definition whose JSON path prefixes the supplied match path so
     * search results can be attributed back to a sidebar section.
     */
    private resolveSectionKey(jsonPath: string): string | null {
        const sorted = [...SECTION_DEFINITIONS].sort((a, b) => b.jsonPath.length - a.jsonPath.length);
        const matched = sorted.find((section) =>
            jsonPath === section.jsonPath
            || jsonPath.startsWith(`${section.jsonPath}.`)
            || jsonPath.startsWith(`${section.jsonPath}[`)
        );
        return matched?.key ?? null;
    }

    /**
     * Input: current base JSON path and next property/index segment.
     * Output: composed JSON path string.
     * Logic: appends either dot notation or array index notation so traversal results use a stable,
     * readable path format.
     */
    private joinPath(base: string, next: string): string {
        if (!base) return /^\d+$/.test(next) ? `[${next}]` : next;
        return /^\d+$/.test(next) ? `${base}[${next}]` : `${base}.${next}`;
    }

    /**
     * Input: arbitrary candidate value.
     * Output: none; throws when the value is missing.
     * Logic: enforces that write and validation endpoints receive an explicit JSON payload instead of
     * silently treating an omitted body as intentional input.
     */
    private assertValueProvided(value: any) {
        if (value === undefined) {
            throw new BadRequestException('A JSON value payload is required.');
        }
    }
}
