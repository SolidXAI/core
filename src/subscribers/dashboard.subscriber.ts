import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from "@nestjs/typeorm";
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import { Dashboard } from 'src/entities/dashboard.entity';
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { DashboardMapper } from 'src/mappers/dashboard-mapper';
import { DashboardService } from 'src/services/dashboard.service';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from "typeorm";

@Injectable()
export class DashboardSubscriber implements EntitySubscriberInterface<Dashboard> {
    private readonly logger = new Logger(this.constructor.name);
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        readonly moduleMetadataHelperService: ModuleMetadataHelperService,
        readonly dashboardService: DashboardService, // Assuming you have a DashboardService for custom queries
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return Dashboard;
    }

    async afterInsert(event: InsertEvent<Dashboard>) {
        if (!event.entity) {
            this.logger.debug('No dashboard entity found in the DashboardSubscriber afterInsert method');
            return;
        }
        await this.dashboardService.saveDashboardToConfig(event.entity);
    }

    async afterUpdate(event: UpdateEvent<Dashboard>) {
        if (!event.entity) {
            this.logger.debug('No dashboard entity found in the DashboardSubscriber afterInsert method');
            return;
        }

        await this.dashboardService.saveDashboardToConfig(event.databaseEntity);
    }

}