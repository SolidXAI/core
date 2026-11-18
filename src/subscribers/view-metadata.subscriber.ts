import { InjectDataSource } from "@nestjs/typeorm";
import { ViewMetadata } from "src/entities/view-metadata.entity";
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { DataSource, EntitySubscriberInterface, UpdateEvent } from "typeorm";
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await


export class ViewMetadataSubsciber implements EntitySubscriberInterface<ViewMetadata> {
    private readonly logger = new Logger(ViewMetadataSubsciber.name);
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        readonly moduleMetadataHelperService: ModuleMetadataHelperService,

    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return ViewMetadata;
    }

    async afterUpdate(event: UpdateEvent<ViewMetadata>): Promise<void> {
        // Update the metadata json after updating the view
        const viewMetadataRepo = event.manager.getRepository(ViewMetadata);
        const viewMetadata = await viewMetadataRepo.findOne({
            where: {
                id: event.entity.id
            },
            relations: {
                model: {
                    module: true
                }
            }
        });
        if (!viewMetadata) {
            throw new Error(`View metadata not found for id ${event.entity.id}`);
        }

        // solid-core module metadata file is stored in the npm package when installed, so we do not propogate those changes to the solid-core-metadata.json file
        if (viewMetadata.model.module.name != "solid-core") {
            const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(viewMetadata.model.module.name);
            try {
                await fs.access(filePath);
            } catch (error: any) {
                this.logger.error(`File not found at path: ${filePath}`);
                return;
            }
            const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);

            // Update the view metadata in the module metadata
            const viewMetadataIndex = metaData.views.findIndex((view: { name: string }) => view.name === event.entity.name);
            if (viewMetadataIndex !== -1) {
                metaData.views[viewMetadataIndex].layout = JSON.parse(event.entity.layout);
            }
            // Write the updated object back to the file
            const updatedContent = JSON.stringify(metaData, null, 2);
            await fs.writeFile(filePath, updatedContent);
        }
    }
}