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
        private readonly r2rService: R2RHelperService,
    ) { }

    // Stable stringify so hashes/ids don't flap
    // private stableStringify(obj: any): string {
    //     return JSON.stringify(obj, Object.keys(obj).sort(), 2);
    // }
    // private sha256(input: string): string {
    //     return crypto.createHash('sha256').update(input).digest('hex');
    // }
    // private hashSchema(obj: any): string {
    //     return this.sha256(this.stableStringify(obj));
    // }
    private _sha256OfJson(obj: any): string {
        const s = JSON.stringify(obj);
        return crypto.createHash('sha256').update(s).digest('hex');
    }
    // // Small natural-language one-liners for relations
    // private relationSig(model: any): string[] {
    //     const rels: string[] = [];
    //     for (const f of model.fields ?? []) {
    //         if (f.relation?.targetModel) {
    //             rels.push(`${model.singularName}.${f.name} -> ${f.relation.targetModel}(${f.relation.targetField ?? 'id'})`);
    //         }
    //     }
    //     return rels;
    // }

    private _oneLineBool(b?: boolean): 'yes' | 'no' {
        return b ? 'yes' : 'no';
    }

    private _shortList(arr?: string[] | null, max = 10): string {
        if (!Array.isArray(arr) || arr.length === 0) return 'none';
        const a = arr.slice(0, max);
        return `${a.join(', ')}${arr.length > max ? ', …' : ''}`;
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
            // await this.deleteInsertRagDocumentForModuleMetadataJsonFile(ingestionInfo, fullPath, fileName)

            // Delete and re-insert a chunk representing the module.
            await this.deleteInsertRagChunkForModule(ingestionInfo, moduleMetadata);

            // Delete and re-insert chunks representing each model.
            for (const model of moduleMetadata.models) {
                await this.deleteInsertRagChunkForModel(ingestionInfo, enabledModule, model);

                // Disabling this for now...
                // for (const field of model.fields) {
                //     await this.deleteInsertRagChunkForField(ingestionInfo, enabledModule, model.singularName, field);
                // }
            }

            // TODO: Delete and re-insert chunks representing roles

            // TODO: Delete and re-insert chunks representing menus 

            // TODO: Delete and re-insert chunks representing actions

            // TODO: Delete and re-insert chunks representing list views 

            // TODO: Delete and re-insert chunks representing kanban views 

            // TODO: Delete and re-insert chunks representing form views

            // TODO: Delete and re-insert chunks representing security rules

            // TODO: Delete and re-insert chunks representing scheduled jobs

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
        const contentHash = this._sha256OfJson(JSON.parse(jsonStr));

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
        const schemaHash = this._sha256OfJson({
            name: moduleMetadata?.name ?? null,
            description: moduleMetadata?.description ?? null,

            // Keep model names + brief shape so module-level hash changes when models change.
            models: (moduleMetadata?.models ?? []).map((m: any) => ({
                singularName: m?.singularName ?? null,
                description: m?.description ?? null,

                // Include field names to detect field-level changes at module granularity - maybe remove this later?
                // fields: Array.isArray(m?.fields) ? m.fields.map((f: any) => f?.name ?? null) : [],
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
                await this.ragClient.documents.delete({ id: ingestionInfo.moduleChunkId });
            } catch (e) {
                this.logger.warn(`[Warn] Failed deleting old module chunk (${ingestionInfo.moduleChunkId}): ${String(e)}`);
            }
        }

        const r = await this.ragClient.documents.create({
            chunks: [text],
            // raw_text: text,
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
        const schemaHash = this._sha256OfJson(model);

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

Full model metadata json: 
${JSON.stringify(model)}

`;

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
                await this.ragClient.documents.delete({ id: modelEntry.modelChunkId });
            } catch (e) {
                this.logger.warn(`[Warn] Failed deleting old model chunk (${modelEntry.modelChunkId}): ${String(e)}`);
            }
        }

        // 6) Create new document (R2R auto-generates the ID)
        const r = await this.ragClient.documents.create({
            chunks: [text],
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

    private _buildFieldTextAndMetadata(moduleName: string, modelName: string, f: CreateFieldMetadataDto) {
        // Identity
        const name = f?.name;
        const displayName = f?.displayName ?? name;
        const description = f?.description ?? 'N/A';

        // Types
        const type = f?.type;
        const ormType = f?.ormType ?? null;

        // Constraints / validation
        const required = !!f?.required;
        const unique = !!f?.unique;
        const index = !!f?.index;
        const length = f?.length ?? null;
        const min = f?.min ?? null;
        const max = f?.max ?? null;
        const defaultValue = f?.defaultValue ?? null;
        const regex = f?.regexPattern ?? null;
        const regexErr = f?.regexPatternNotMatchingErrorMsg ?? null;

        // Relation
        const relationType = f?.relationType ?? null; // e.g., many-to-one, many-to-many, one-to-many
        const relModule = f?.relationModelModuleName ?? null;
        const relModel = f?.relationCoModelSingularName ?? null;
        const relField = f?.relationCoModelFieldName ?? 'id';
        // const relOwner = f?.isRelationManyToManyOwner ?? null;
        // const relJoinTable = f?.relationJoinTableName ?? null;
        // const relCreateInverse = !!f?.relationCreateInverse;
        const relCascade = f?.relationCascade ?? null;
        const relFixedFilter = f?.relationFieldFixedFilter ?? null;

        // Selection (dropdowns)
        const selectionDynProvider = f?.selectionDynamicProvider ?? null;
        const selectionDynCtxt = f?.selectionDynamicProviderCtxt ?? null;
        const selectionStatic = Array.isArray(f?.selectionStaticValues) ? f.selectionStaticValues : null;
        const selectionValueType = f?.selectionValueType ?? null;
        const isMultiSelect = !!f?.isMultiSelect;

        // Media (uploads)
        const mediaTypes = Array.isArray(f?.mediaTypes) ? f.mediaTypes : null;
        const mediaMaxSizeKb = f?.mediaMaxSizeKb ?? null;
        const mediaStorageProvider = f?.mediaStorageProviderUserKey ?? null; // likely object/id in your JSON

        // Computed fields
        const computedProvider = f?.computedFieldValueProvider ?? null;
        const computedProviderCtxt = f?.computedFieldValueProviderCtxt ?? null;
        const computedValueType = f?.computedFieldValueType ?? null;
        const computedTriggerCfg = f?.computedFieldTriggerConfig ?? null;

        // Security / privacy / audit
        // const encrypt = !!f?.encrypt;
        // const encryptionType = f?.encryptionType ?? null;
        // const decryptWhen = f?.decryptWhen ?? null;
        const isPrivate = !!f?.private;
        const enableAuditTracking = !!f?.enableAuditTracking;

        // Keys / system flags / mapping
        const isUserKey = !!f?.isUserKey;
        const isSystem = !!f?.isSystem;
        const isMarkedForRemoval = !!f?.isMarkedForRemoval;
        const columnName = f?.columnName ?? null;
        const relCoModelColumn = f?.relationCoModelColumnName ?? null;
        const uuid = f?.uuid ?? null;

        const relationSummary = (() => {
            if (!relationType || !relModel) return 'none';
            const parts = [
                `type=${relationType}`,
                relModule ? `module=${relModule}` : null,
                `model=${relModel}`,
                relField ? `field=${relField}` : null,
                // relOwner !== null ? `m2mOwner=${relOwner}` : null,
                // relCreateInverse ? 'createInverse=yes' : null,
                relCascade ? `cascade=${relCascade}` : null,
                // relJoinTable ? `joinTable=${relJoinTable}` : null,
                relFixedFilter ? `fixedFilter=${relFixedFilter}` : null,
            ].filter(Boolean);
            return parts.join(', ');
        })();

        const selectionSummary = (() => {
            const parts: string[] = [];
            if (selectionDynProvider) parts.push(`dynamicProvider=${selectionDynProvider}`);
            if (selectionDynCtxt) parts.push(`dynamicCtxt=${selectionDynCtxt}`);
            if (selectionStatic?.length) parts.push(`static=[${this._shortList(selectionStatic, 12)}]`);
            if (selectionValueType) parts.push(`valueType=${selectionValueType}`);
            parts.push(`multiSelect=${this._oneLineBool(isMultiSelect)}`);
            return parts.length ? parts.join(', ') : 'none';
        })();

        const mediaSummary = (() => {
            const parts: string[] = [];
            if (mediaTypes?.length) parts.push(`types=[${this._shortList(mediaTypes, 12)}]`);
            if (mediaMaxSizeKb) parts.push(`maxSizeKb=${mediaMaxSizeKb}`);
            if (mediaStorageProvider) parts.push(`storageProvider=${typeof mediaStorageProvider === 'string' ? mediaStorageProvider : 'set'}`);
            return parts.length ? parts.join(', ') : 'none';
        })();

        const computedSummary = (() => {
            const parts: string[] = [];
            if (computedProvider) parts.push(`provider=${computedProvider}`);
            if (computedProviderCtxt) parts.push(`providerCtxt=${computedProviderCtxt}`);
            if (computedValueType) parts.push(`valueType=${computedValueType}`);
            if (computedTriggerCfg?.length) parts.push(`triggers=${computedTriggerCfg.length}`);
            return parts.length ? parts.join(', ') : 'none';
        })();

        const securitySummary = [
            // `encrypt=${this.oneLineBool(encrypt)}`,
            // encryptionType ? `encType=${encryptionType}` : null,
            // decryptWhen ? `decryptWhen=${decryptWhen}` : null,
            `private=${this._oneLineBool(isPrivate)}`,
            `auditTracking=${this._oneLineBool(enableAuditTracking)}`
        ].filter(Boolean).join(', ');

        const constraintSummary = [
            `required=${this._oneLineBool(required)}`,
            `unique=${this._oneLineBool(unique)}`,
            `index=${this._oneLineBool(index)}`,
            length !== null ? `length=${length}` : null,
            min !== null ? `min=${min}` : null,
            max !== null ? `max=${max}` : null,
            defaultValue !== null ? `default=${defaultValue}` : null,
            regex ? `regex=${regex}${regexErr ? ` (${regexErr})` : ''}` : null
        ].filter(Boolean).join(', ');

        const mappingSummary = [
            columnName ? `column=${columnName}` : null,
            relCoModelColumn ? `relColumn=${relCoModelColumn}` : null,
            uuid ? `uuid=${uuid}` : null,
            `userKey=${this._oneLineBool(isUserKey)}`,
            `system=${this._oneLineBool(isSystem)}`,
            `markedForRemoval=${this._oneLineBool(isMarkedForRemoval)}`
        ].filter(Boolean).join(', ');

        const text = [
            `SolidX Field: ${name} (${displayName})`,
            `Model: ${modelName}`,
            `Module: ${moduleName}`,
            ``,
            `Type: ${type}${ormType ? ` (orm=${ormType})` : ''}`,
            `Description: ${description}`,
            ``,
            `Constraints: ${constraintSummary || 'none'}`,
            `Relation: ${relationSummary}`,
            `Selection: ${selectionSummary}`,
            `Media: ${mediaSummary}`,
            `Computed: ${computedSummary}`,
            `Security/Privacy/Audit: ${securitySummary}`,
            `Mapping/Flags: ${mappingSummary || 'none'}`,
            ``,
            `Usage: Use this chunk to generate exact field contracts (DTO, form control, DB column), `,
            `validation rules, relation wiring, and UI widgets (selection/media/computed).`,
        ].join('\n');

        const metadata = {
            kind: 'solidx-metadata',
            type: 'field',
            moduleName,
            modelName,
            fieldName: name,
            displayName,
            description,
            dataType: type,
            ormType,
            required,
            unique,
            index,
            defaultValue,
            length,
            min,
            max,
            regexPattern: regex,
            regexPatternNotMatchingErrorMsg: regexErr,

            // relation
            relationType,
            relationModelModuleName: relModule,
            relationCoModelSingularName: relModel,
            relationCoModelFieldName: relField,
            // isRelationManyToManyOwner: relOwner,
            // relationJoinTableName: relJoinTable,
            // relationCreateInverse: relCreateInverse,
            relationCascade: relCascade,
            relationFieldFixedFilter: relFixedFilter,

            // selection
            selectionDynProvider,
            selectionDynCtxt,
            selectionStaticValues: selectionStatic,
            selectionValueType,
            isMultiSelect,

            // media
            mediaTypes,
            mediaMaxSizeKb,
            mediaStorageProvider: mediaStorageProvider ? (typeof mediaStorageProvider === 'string' ? mediaStorageProvider : 'set') : null,

            // computed
            computedFieldValueProvider: computedProvider,
            computedFieldValueProviderCtxt: computedProviderCtxt,
            computedFieldValueType: computedValueType,
            computedFieldTriggerConfigCount: Array.isArray(computedTriggerCfg) ? computedTriggerCfg.length : 0,

            // security/privacy/audit
            // encrypt,
            // encryptionType,
            // decryptWhen,
            private: isPrivate,
            enableAuditTracking,

            // mapping/flags
            columnName,
            relationCoModelColumnName: relCoModelColumn,
            isUserKey,
            isSystem,
            isMarkedForRemoval,
        };

        return { text, metadata };
    }

    private async deleteInsertRagChunkForField(ingestionInfo: ModuleRAGIngestionInfo, moduleName: string, modelName: string, field: CreateFieldMetadataDto,): Promise<string> {
        const fieldName: string = field?.name ?? 'unknown_field';

        // 1) Full JSON hash (as-is)
        const schemaHash = this._sha256OfJson(field);

        // 2) Ensure ingestionInfo entry for the model & field
        const modelsArr = ingestionInfo.models ?? (ingestionInfo.models = []);
        let modelEntry = modelsArr.find(m => m.modelName === modelName);
        if (!modelEntry) {
            modelEntry = { modelName, fields: [] };
            modelsArr.push(modelEntry);
        }
        const fieldsArr = modelEntry.fields ?? (modelEntry.fields = []);
        let fieldEntry = fieldsArr.find(f => f.fieldName === fieldName);
        if (!fieldEntry) {
            fieldEntry = { fieldName };
            fieldsArr.push(fieldEntry);
        }

        // 3) Skip if unchanged
        if (fieldEntry.fieldHash === schemaHash && fieldEntry.fieldChunkId) {
            this.logger.log(`[Skip] Field unchanged: ${moduleName}.${modelName}.${fieldName}`);
            return fieldEntry.fieldChunkId;
        }

        // 4) Build text + metadata tailored to FieldMetadata
        const { text, metadata } = this._buildFieldTextAndMetadata(moduleName, modelName, field);

        // also keep the hash in metadata for audit/debug
        (metadata as any).schemaHash = schemaHash;

        // 5) Delete previous chunk if present
        if (fieldEntry.fieldChunkId) {
            try {
                await this.ragClient.documents.delete({ id: fieldEntry.fieldChunkId });
            } catch (e) {
                this.logger.warn(`[Warn] Failed deleting old field chunk (${fieldEntry.fieldChunkId}): ${String(e)}`);
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
            throw new Error(`R2R did not return a documentId while creating field chunk for ${moduleName}.${modelName}.${fieldName}`);
        }

        // 7) Update ingestion info
        fieldEntry.fieldChunkId = newId;
        fieldEntry.fieldHash = schemaHash;

        this.logger.log(`[OK] Ingested field ${moduleName}.${modelName}.${fieldName} → id=${newId}, hash=${schemaHash.slice(0, 8)}…`);
        return newId;
    }
}