import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from "@nestjs/typeorm";
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import { Dashboard } from 'src/entities/dashboard.entity';
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { DashboardMapper } from 'src/mappers/dashboard-mapper';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from "typeorm";

@Injectable()
export class DashboardSubscriber implements EntitySubscriberInterface<Dashboard> {
    private readonly logger = new Logger(this.constructor.name);
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        readonly moduleMetadataHelperService: ModuleMetadataHelperService,
        readonly dashboardMapper: DashboardMapper,
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return Dashboard;
    }

    async afterInsert(event: InsertEvent<Dashboard>) {
        await this.saveDashboardToConfig(event.entity);
    }

    async afterUpdate(event: UpdateEvent<Dashboard>) {
        await this.saveDashboardToConfig(event.databaseEntity);
    }

    async saveDashboardToConfig(entity: Dashboard) {
        if (!entity) {
            this.logger.debug('No entity found in the DashboardSubscriber saveDashboardToConfig method');
            return;
        }
        
        // Validate dashboard details
        const dashboard = entity as Dashboard;
        const moduleMetadata = entity.module;
        if (!moduleMetadata) {
            throw new Error(`Module metadata not found for dashboard id ${entity.id}`);
        }

        // Get config file details
        const { filePath, metaData } = await this.getConfigFileDetails(moduleMetadata.name);
        if (!filePath || !metaData) {
            throw new Error(`Configuration details not found for module: ${moduleMetadata.name}`);
        }

        // Write the dashboard to the config file
        await this.writeToConfig(metaData, dashboard, filePath);
    }

    private async getConfigFileDetails(moduleName: string): Promise<{ filePath: string; metaData: any }> {
        const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        try {
            await fs.access(filePath);
        } catch (error) {
            throw new Error(`Configuration file not found for module: ${moduleName}`);
        }
        const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);
        return { filePath, metaData };
    }

    private async writeToConfig(metaData: any, dashboard: Dashboard, filePath: string) {
        if (metaData.dashboards) {
            const dashboardIndex = metaData.dashboards?.findIndex((dashboardFromFile: { name: string; }) => dashboardFromFile.name === dashboard.name);
            const dto = await this.dashboardMapper.toDto(dashboard);
            metaData.dashboards[dashboardIndex] = dto;
        }
        else {
            const dashboards = [];
            const dto = await this.dashboardMapper.toDto(dashboard);
            dashboards.push(dto);
            metaData.dashboards = dashboards;
        }
        // Write the updated object back to the file
        const updatedContent = JSON.stringify(metaData, null, 2);
        await fs.writeFile(filePath, updatedContent);
    }
}