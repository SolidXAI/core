import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import solidCoreMetadata from '../../seeders/seed-data/solid-core-metadata.json';

import { Setting } from 'src/entities/setting.entity';
import { SecurityRuleRepository } from 'src/repository/security-rule.repository';
import { DashboardRepository } from 'src/repository/dashboard.repository';
import { ScheduledJobRepository } from 'src/repository/scheduled-job.repository';
import { MediaStorageProviderMetadataSeederService } from '../media-storage-provider-metadata-seeder.service';
import { SystemFieldsSeederService } from 'src/seeders/system-fields-seeder.service';
import { getDynamicModuleNames } from 'src/helpers/module.helper';
import { CreateModuleMetadataDto } from 'src/dtos/create-module-metadata.dto';
import { R2RHelperService } from './r2r-helper.service';
import { CollectionResponse, r2rClient } from 'r2r-js';
import { exist } from '@hapi/joi';


// const ING_INFO_FULL_FILE_DOC_ID = 'fullFileDocumentId';

export type ModuleRAGIngestionInfo = {
    collectionId: string;
    documentId: string;
};


@Injectable()
export class IngestMetadataService {
    private readonly logger = new Logger(IngestMetadataService.name);
    private readonly ragClient: r2rClient;

    constructor(
        private readonly mediaStorageProviderSeederService: MediaStorageProviderMetadataSeederService,
        @InjectRepository(Setting, 'default')
        readonly settingsRepo: Repository<Setting>,
        readonly securityRuleRepo: SecurityRuleRepository,
        readonly systemFieldsSeederService: SystemFieldsSeederService,
        readonly dashboardRepo: DashboardRepository,
        readonly scheduledJobRepository: ScheduledJobRepository,
        private readonly r2rService: R2RHelperService,
    ) { }

    async ingest() {
        // @ts-ignore
        // const ragServiceHealth = await this.r2rService.getClient().health();
        // this.logger.debug('R2R service health check: ', ragServiceHealth)

        // const typedSolidCoreMetadata: any = structuredClone(solidCoreMetadata);
        // const allModuleMetadataJson = [typedSolidCoreMetadata];

        this.ragClient = await this.r2rService.getClient();

        const allModuleMetadataJson = [];
        this.logger.debug(`getting dynamics modules`);
        const enabledModules = getDynamicModuleNames();
        this.logger.log(`ingesting metadata`);

        for (let i = 0; i < enabledModules.length; i++) {
            const enabledModule = enabledModules[i];
            const fileName = `${enabledModule}-metadata.json`;
            const enabledModuleSeedFile = `module-metadata/${enabledModule}/${fileName}`;
            const fullPath = path.join(process.cwd(), enabledModuleSeedFile);

            // Manage all the ingestion info file paths...
            const enabledModulIngestionInfoFile = `module-metadata/${enabledModule}/genai/${enabledModule}-ingested-info.json`;
            const enabledModulIngestionInfoFullPath = path.join(process.cwd(), enabledModulIngestionInfoFile);
            const ingestionInfo: ModuleRAGIngestionInfo = fs.existsSync(enabledModulIngestionInfoFullPath) ? JSON.parse(fs.readFileSync(enabledModulIngestionInfoFullPath, 'utf-8').toString()) : {};
            const enabledModulIngestionInfoDir = path.dirname(enabledModulIngestionInfoFullPath);
            if (!fs.existsSync(enabledModulIngestionInfoDir)) {
                fs.mkdirSync(enabledModulIngestionInfoDir, { recursive: true });
            }

            if (fs.existsSync(fullPath)) {
                const overallMetadata: any = JSON.parse(fs.readFileSync(fullPath, 'utf-8').toString());

                // Resolve collection
                ingestionInfo.collectionId = await this.resolveRagCollectionForModule(ingestionInfo, enabledModule);

                // Ingest full files... 
                ingestionInfo.documentId = await this.deleteInsertRagDocumentForModule(ingestionInfo, fullPath, fileName);

                // Process module metadata first. 
                const moduleMetadata: CreateModuleMetadataDto = overallMetadata.moduleMetadata;
                this.logger.log(`[Start] Processing module metadata for ${moduleMetadata.name}`)

                // Save ingestion info to disk...
                fs.writeFileSync(enabledModulIngestionInfoFullPath, JSON.stringify({ingestionInfo}, null, 2), 'utf8');
            }
        }

    }

    private async resolveRagCollectionForModule(ingestionInfo: ModuleRAGIngestionInfo, moduleName: string): Promise<string> {
        this.logger.debug(`Creating RAG collection for module: ${moduleName}`);

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

    private async deleteInsertRagDocumentForModule(ingestionInfo: ModuleRAGIngestionInfo, fullPath: string, fileName: string): Promise<string> {
        this.logger.debug(`ingesting file: ${fullPath}`);
        // Delete if existing...
        if (ingestionInfo.documentId) {
            await this.ragClient.documents.delete({ id: ingestionInfo.documentId });
        }

        // Now re-create...
        const ingestResult = await this.ragClient.documents.create({
            file: {
                path: fullPath,
                name: fileName
            },
            metadata: {},
        });
        console.log("file ingest result:", JSON.stringify(ingestResult, null, 2));

        return ingestResult.results.documentId;

    }

}