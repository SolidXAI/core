import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { getDynamicModuleNames } from 'src/helpers/module.helper';
import { CreateModuleMetadataDto } from 'src/dtos/create-module-metadata.dto';
import { R2RHelperService } from './r2r-helper.service';
import { CollectionResponse, r2rClient } from 'r2r-js';
import { CreateModelMetadataDto } from 'src/dtos/create-model-metadata.dto';
import { CreateFieldMetadataDto } from 'src/dtos/create-field-metadata.dto';

export type FieldIngestionInfo = {
    fieldName: string;
    fieldChunkId?: string;
    fieldHash?: string;
};

export type ModelIngestionInfo = {
    modelName: string;
    modelChunkId?: string;
    modelHash?: string;
    fields: FieldIngestionInfo[];
};

export type ModuleRAGIngestionInfo = {
    moduleName?: string;
    collectionId?: string;

    // Full json document is also uploaded so we track references...
    documentId?: string;
    documentHash?: string;

    // module references
    moduleChunkId?: string;
    // track a hash of module metadata to skip unchanged
    moduleHash?: string;

    // model references...
    models: ModelIngestionInfo[];
};

@Injectable()
export class IngestMetadataService {
    private readonly logger = new Logger(IngestMetadataService.name);
    private ragClient: r2rClient;

    constructor(
        // @InjectRepository(Setting, 'default')
        // readonly settingsRepo: Repository<Setting>,
        // readonly securityRuleRepo: SecurityRuleRepository,
        // readonly systemFieldsSeederService: SystemFieldsSeederService,
        // readonly dashboardRepo: DashboardRepository,
        // readonly scheduledJobRepository: ScheduledJobRepository,
        private readonly r2rService: R2RHelperService,
    ) { }

    // Stable stringify so hashes/ids don't flap
    private stableStringify(obj: any): string {
        return JSON.stringify(obj, Object.keys(obj).sort(), 2);
    }

    private sha256(input: string): string {
        return crypto.createHash('sha256').update(input).digest('hex');
    }

    // private buildChunkExternalId(moduleName: string, modelName?: string, fieldName?: string): string {
    //     const key = [moduleName, modelName ?? '', fieldName ?? ''].join(':');
    //     return `sx:${this.sha256(key).slice(0, 24)}`; // short but unique
    // }

    private hashSchema(obj: any): string {
        return this.sha256(this.stableStringify(obj));
    }

    // Small natural-language one-liners for relations
    private relationSig(model: any): string[] {
        const rels: string[] = [];
        for (const f of model.fields ?? []) {
            if (f.relation?.targetModel) {
                rels.push(`${model.singularName}.${f.name} -> ${f.relation.targetModel}(${f.relation.targetField ?? 'id'})`);
            }
        }
        return rels;
    }

    private summarizeModel(model: any): { oneLine: string; importantFields: string[] } {
        const primary = (model.fields ?? []).find((f: any) => f.isPrimary) ?? {};
        const uniques = (model.fields ?? []).filter((f: any) => f.isUnique).map((f: any) => f.name);
        const req = (model.fields ?? []).filter((f: any) => f.required).map((f: any) => f.name);
        const rels = this.relationSig(model);

        const oneLine = `${model.singularName}: ${model.description ?? 'no description'}. ` +
            `Primary: ${primary.name ?? 'id'}. ` +
            (uniques.length ? `Unique: ${uniques.join(', ')}. ` : '') +
            (rels.length ? `Relations: ${rels.length}.` : 'No relations.');

        const importantFields = [
            primary?.name && `Primary: ${primary.name}`,
            uniques.length && `Unique: ${uniques.join(', ')}`,
            req.length && `Required: ${req.slice(0, 6).join(', ')}${req.length > 6 ? '…' : ''}`
        ].filter(Boolean) as string[];

        return { oneLine, importantFields };
    }

    async ingest() {
        // Create a new ragClient...
        this.ragClient = await this.r2rService.getClient();

        // const allModuleMetadataJson = [];
        this.logger.debug(`getting dynamics modules`);
        const enabledModules = getDynamicModuleNames();
        this.logger.log(`ingesting metadata`);

        for (let i = 0; i < enabledModules.length; i++) {
            const enabledModule = enabledModules[i];
            const fileName = `${enabledModule}-metadata.json`;
            const enabledModuleSeedFile = `module-metadata/${enabledModule}/${fileName}`;
            const fullPath = path.join(process.cwd(), enabledModuleSeedFile);
            const overallMetadata: any = JSON.parse(fs.readFileSync(fullPath, 'utf-8').toString());

            const moduleMetadata: CreateModuleMetadataDto = overallMetadata.moduleMetadata;

            // Manage all the ingestion info file paths...
            const enabledModulIngestionInfoFile = `module-metadata/${enabledModule}/genai/${enabledModule}-ingested-info.json`;
            const enabledModulIngestionInfoFullPath = path.join(process.cwd(), enabledModulIngestionInfoFile);
            const ingestionInfo: ModuleRAGIngestionInfo = fs.existsSync(enabledModulIngestionInfoFullPath) ? JSON.parse(fs.readFileSync(enabledModulIngestionInfoFullPath, 'utf-8').toString()) : {};
            const enabledModulIngestionInfoDir = path.dirname(enabledModulIngestionInfoFullPath);
            if (!fs.existsSync(enabledModulIngestionInfoDir)) {
                fs.mkdirSync(enabledModulIngestionInfoDir, { recursive: true });
            }

            ingestionInfo.moduleName = enabledModule

            // Process module metadata first. 
            this.logger.log(`[Start] Processing module metadata for ${moduleMetadata.name}`)

            // Create or use an existing collection...
            const collectionId = await this.resolveRagCollectionForModule(ingestionInfo, enabledModule)
            ingestionInfo.collectionId = collectionId;

            // Delete and re-insert a document representing the full json...
            await this.deleteInsertRagDocumentForModuleMetadataJsonFile(ingestionInfo, fullPath, fileName)

            // Delete and re-insert a chunk representing the module.
            await this.deleteInsertRagChunkForModule(ingestionInfo, moduleMetadata);

            // Delete and re-insert chunks representing each model.
            const models = moduleMetadata.models;
            for (let iM = 0; iM < models.length; iM++) {
                const model = models[iM];
                await this.deleteInsertRagChunkForModel(ingestionInfo, enabledModule, model);
            }

            // Save ingestion info to disk...
            fs.writeFileSync(enabledModulIngestionInfoFullPath, JSON.stringify({ ...ingestionInfo }, null, 2), 'utf8');
        }
    }

    private async resolveRagCollectionForModule(ingestionInfo: ModuleRAGIngestionInfo, moduleName: string): Promise<string> {
        this.logger.debug(`Resolving RAG collection for module: ${moduleName}`);

        let existingCollection: CollectionResponse = null;
        if (ingestionInfo.collectionId) {
            // See if collection already exists... 
            const r = await this.ragClient.collections.list({
                ids: [
                    ingestionInfo.collectionId
                ]
            });

            if (r) {
                if (r.results.length === 1) {
                    existingCollection = r.results[0];
                }
                if (r.results.length > 1) {
                    // TODO: do something that will print a meaningful error on the console...
                }
            }
        }

        if (!existingCollection) {
            const r = await this.ragClient.collections.create({
                name: `${moduleName}-rag-collection`,
                description: `Collection created to group all documents, chunks related to module: ${moduleName}`
            });

            // TODO: for some reason if we are unable to create a collection then fail with a visible error message in the console...

            return r.results.id;
        }

        return existingCollection.id;
    }

    private async deleteInsertRagDocumentForModuleMetadataJsonFile(ingestionInfo: ModuleRAGIngestionInfo, fullPath: string, fileName: string): Promise<void> {
        this.logger.debug(`Ingesting file: ${fullPath}`);

        // 1) Compute hash of the entire JSON string (as-is)
        const jsonStr = fs.readFileSync(fullPath, 'utf-8');
        const contentHash = this.hashSchema(JSON.parse(jsonStr));

        // 2) Short-circuit if unchanged and we still have a documentId
        if (ingestionInfo.documentHash === contentHash && ingestionInfo.documentId) {
            this.logger.log(`[Skip] Unchanged: ${fileName} (hash=${contentHash.slice(0, 8)}…)`);
            return;
            // return ingestionInfo.documentId;
        }

        // 3) Delete the previous doc if present
        if (ingestionInfo.documentId) {
            try {
                await this.ragClient.documents.delete({ id: ingestionInfo.documentId });
            } catch (e) {
                this.logger.warn(
                    `[Warn] Failed deleting prior document ${ingestionInfo.documentId}: ${String(e)}`
                );
            }
        }

        // 4) Create a fresh document; attach the hash into metadata for traceability
        const ingestResult = await this.ragClient.documents.create({
            file: {
                path: fullPath,
                name: fileName
            },
            collectionIds: [ingestionInfo.collectionId],
            metadata: {
                contentHash,
                fileName
            },
        });
        // console.log("file ingest result:", JSON.stringify(ingestResult, null, 2));

        const newId = ingestResult?.results?.documentId;
        if (!newId) {
            throw new Error(`R2R did not return a documentId for ${fileName}`);
        }

        // 5) Persist identifiers + hash on our side
        ingestionInfo.documentId = newId;
        ingestionInfo.documentHash = contentHash;

        this.logger.log(`[OK] Ingested ${fileName} → id=${newId}, hash=${contentHash.slice(0, 8)}…`);
        // return newId;

    }

    private async deleteInsertRagChunkForModule(ingestionInfo: ModuleRAGIngestionInfo, moduleMetadata: CreateModuleMetadataDto): Promise<void> {
        const moduleName: string = moduleMetadata?.name;

        // Hash the meaningful parts of the module to detect changes and skip re-ingest.
        const schemaHash = this.hashSchema({
            name: moduleMetadata?.name ?? null,
            description: moduleMetadata?.description ?? null,

            // Keep model names + brief shape so module-level hash changes when models change.
            models: (moduleMetadata?.models ?? []).map((m: any) => ({
                singularName: m?.singularName ?? null,
                description: m?.description ?? null,

                // Include field names to detect field-level changes at module granularity - maybe remove this later?
                fields: Array.isArray(m?.fields) ? m.fields.map((f: any) => f?.name ?? null) : [],
            })),
        });

        // Skip unchanged module
        if (ingestionInfo.moduleHash === schemaHash && ingestionInfo.moduleChunkId) {
            this.logger.log(`[Skip] Module unchanged: ${moduleName}`);
            return;
            // return ingestionInfo.moduleChunkId;
        }

        const models: any[] = moduleMetadata?.models ?? [];
        const modelLines = models.map((m) => {
            const name = m?.singularName;
            const desc = m?.description ? `: ${m.description}` : '';
            return `- ${name}${desc}`;
        });

        const text = `SolidX Module: ${moduleName}
Purpose: ${moduleMetadata?.description ?? 'N/A'}

Models (${models.length}):
${modelLines.join('\n')}

Usage: Use this chunk to choose the correct model/field chunks for code generation or metadata edits.`;

        // metadata has to be concise and queryable
        const metadata = {
            kind: 'solidx-metadata',
            type: 'module',
            moduleName,
            modelCount: models.length,
            schemaHash,
            models: models.map((m) => m?.singularName).filter(Boolean),
        };

        // Delete previous chunk if we have one
        if (ingestionInfo.moduleChunkId) {
            try {
                await this.ragClient.chunks.delete({ id: ingestionInfo.moduleChunkId });
            } catch (e) {
                this.logger.warn(`[Warn] Failed deleting old module chunk (${ingestionInfo.moduleChunkId}): ${String(e)}`);
            }
        }

        const r = await this.ragClient.documents.create({
            raw_text: text,
            metadata: metadata,
            collectionIds: [ingestionInfo.collectionId],
        });

        const newId = r?.results?.documentId;
        if (!newId) {
            throw new Error(`R2R did not return a documentId while creating module chunk for module name ${moduleName}`);
        }

        // Update ingestion info for persistence by the caller
        ingestionInfo.moduleChunkId = r.results?.documentId;
        ingestionInfo.moduleHash = schemaHash;

        this.logger.log(`[OK] Ingested module ${moduleName} → id=${newId}, hash=${schemaHash.slice(0, 8)}…`);

    }

    private async deleteInsertRagChunkForModel(ingestionInfo: ModuleRAGIngestionInfo, moduleName: string, model: CreateModelMetadataDto): Promise<void> {
        const modelName: string = model?.singularName;

        // 1) Hash full JSON (as-is) to detect changes and skip re-ingest
        const schemaHash = this.hashSchema(model);

        // Ensure ingestionInfo.models[] has an entry for this model
        const modelsArr = ingestionInfo.models ?? (ingestionInfo.models = []);
        let modelEntry = modelsArr.find(m => m.modelName === modelName);
        if (!modelEntry) {
            modelEntry = { modelName, fields: [] };
            modelsArr.push(modelEntry);
        }

        // 2) Short-circuit if unchanged
        if (modelEntry.modelHash === schemaHash && modelEntry.modelChunkId) {
            this.logger.log(`[Skip] Model unchanged: ${moduleName}.${modelName}`);
            return;
            // return modelEntry.modelChunkId;
        }

        // 3) Build retrieval-friendly text (concise)
        const fields: CreateFieldMetadataDto[] = Array.isArray(model?.fields) ? model.fields : [];
        const userkey = fields.find((f: CreateFieldMetadataDto) => f?.isUserKey)?.name ?? 'id';
        const uniques = fields.filter((f: CreateFieldMetadataDto) => f?.unique).map((f: any) => f.name);
        const required = fields.filter((f: CreateFieldMetadataDto) => f?.required).map((f: any) => f.name);
        const rels = fields
            .filter((f: CreateFieldMetadataDto) => f.type === 'relation')
            .map((f: CreateFieldMetadataDto) => `${modelName}.${f.name} -> ${f.relationCoModelSingularName}.${f.relationCoModelColumnName ?? 'id'}`);

        const fieldSummaryLines = fields.slice(0, 30).map((f: CreateFieldMetadataDto) => {
            const bits = [
                `${f.name}:${f.type}`,
                f.required ? 'req' : '',
                f.unique ? 'unique' : '',
                f.isUserKey ? 'userkey' : '',
                f.relationCoModelSingularName ? `rel->${f.relationCoModelSingularName}` : '',
            ].filter(Boolean).join('|');
            return `- ${bits}`;
        });

        const text =
            `SolidX Model: ${modelName}
Module: ${moduleName}
Purpose: ${model?.description ?? 'N/A'}

Signature:
- Primary: ${userkey}
- Unique: ${uniques.length ? uniques.join(', ') : 'none'}
- Required (${required.length}): ${required.slice(0, 12).join(', ')}${required.length > 12 ? '…' : ''}

Relations (${rels.length}):
${rels.length ? `- ${rels.join('\n- ')}` : 'None'}

Fields (${fields.length}) [name:type|flags]:
${fieldSummaryLines.join('\n')}

Usage: Use this chunk to generate DTOs, subscribers, custom service methods, and CRUD handlers for ${modelName}.
For exact constraints (enum/min/max/regex/default), consult the individual field chunks.`;

        // 4) Metadata (concise & queryable)
        const metadata = {
            kind: 'solidx-metadata',
            type: 'model',
            moduleName,
            modelName,
            fieldCount: fields.length,
            requiredCount: required.length,
            relationCount: rels.length,
            userkey: userkey,
            uniqueFields: uniques,
            hasTimestamps: !!fields.find((f: CreateFieldMetadataDto) => ['time', 'date', 'datetime'].includes(f.type)),
            schemaHash,
        };

        // 5) Delete previous chunk if present
        if (modelEntry.modelChunkId) {
            try {
                await this.ragClient.chunks.delete({ id: modelEntry.modelChunkId });
            } catch (e) {
                this.logger.warn(`[Warn] Failed deleting old model chunk (${modelEntry.modelChunkId}): ${String(e)}`);
            }
        }

        // 6) Create new document (R2R auto-generates the ID)
        const r = await this.ragClient.documents.create({
            raw_text: text,
            metadata,
            collectionIds: [ingestionInfo.collectionId],
        });

        const newId = r?.results?.documentId;
        if (!newId) {
            throw new Error(`R2R did not return a documentId while creating model chunk for ${moduleName}.${modelName}`);
        }

        // 7) Update ingestionInfo for persistence
        modelEntry.modelChunkId = newId;
        modelEntry.modelHash = schemaHash;

        this.logger.log(`[OK] Ingested model ${moduleName}.${modelName} → id=${newId}, hash=${schemaHash.slice(0, 8)}…`);
        // return newId;
    }
}