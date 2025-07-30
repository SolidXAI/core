import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from "@nestjs/typeorm";
import { Dashboard } from 'src/entities/dashboard.entity';
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { DashboardService } from 'src/services/dashboard.service';
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, UpdateEvent } from "typeorm";

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
        await this.saveDashboardToConfig(event.entity, event.queryRunner.manager);
    }

    async afterUpdate(event: UpdateEvent<Dashboard>) {
        if (!event.entity) {
            this.logger.debug('No dashboard entity found in the DashboardSubscriber afterInsert method');
            return;
        }

        await this.saveDashboardToConfig(event.databaseEntity, event.queryRunner.manager);
    }

    private async saveDashboardToConfig(dashboard: Dashboard, entityManager: EntityManager): Promise<void> {
        if (!dashboard || !dashboard.id) {
            this.logger.debug('Dashboard or dashboard id is undefined');
            return;
        }

        // Load the dashboard with module relation populated
        const populatedDashboard = await entityManager.findOne(Dashboard, {
            where: { id: dashboard.id },
            relations: ['module','dashboardVariables', 'questions', 'questions.questionSqlDatasetConfigs'],
        });

        if (!populatedDashboard) {
            this.logger.error(`Dashboard not found for id ${dashboard.id}`);
            return;
        }

        // Call the saveDashboardToConfig method from the DashboardService
        await this.dashboardService.saveDashboardToConfig(populatedDashboard);
    }

}