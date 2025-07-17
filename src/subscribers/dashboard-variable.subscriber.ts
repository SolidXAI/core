import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DashboardVariable } from "src/entities/dashboard-variable.entity";
import { Dashboard } from "src/entities/dashboard.entity";
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { DashboardVariableService } from "src/services/dashboard-variable.service";
import { DashboardService } from "src/services/dashboard.service";
import { EntitySubscriberInterface, DataSource, InsertEvent, UpdateEvent, EntityManager } from "typeorm";

@Injectable()
export class DashboardVariableSubscriber implements EntitySubscriberInterface<DashboardVariable> {
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
        return DashboardVariable;
    }

    async afterInsert(event: InsertEvent<DashboardVariable>) {
        if (!event.entity) {
            this.logger.debug('No dashboard variable entity found in the DashboardVariableSubscriber afterInsert method');
            return;
        }
        await this.saveDashboardToConfig(event.entity, event.queryRunner.manager);
    }

    async afterUpdate(event: UpdateEvent<DashboardVariable>) {
        if (!event.databaseEntity) {
            this.logger.debug('No dashboard variable entity found in the DashboardVariableSubscriber afterUpdate method');
            return;
        }
        await this.saveDashboardToConfig(event.databaseEntity, event.queryRunner.manager);
    }

    private async saveDashboardToConfig(dashboardVariable: DashboardVariable, entityManager: EntityManager): Promise<void> {
        const dashboard = dashboardVariable.dashboard;
        // Get the dashboard from the question & call the saveDashboardToConfig method
        if (!dashboard) {
            this.logger.debug(`Dashboard is undefined for dashboard variable id ${dashboardVariable.id}`);
            return;
        }

        // populate the dashboard with its variables
        const populatedDashboard = await entityManager.findOne(Dashboard, {
            where: { id: dashboard.id },
            relations: ['module','dashboardVariables', 'questions', 'questions.questionSqlDatasetConfigs'],
        });

        if (!populatedDashboard) {
            throw new Error(`Dashboard not found for question id ${populatedDashboard.id}`);
        }

        // Call the saveDashboardToConfig method from the DashboardService
        await this.dashboardService.saveDashboardToConfig(populatedDashboard);
    }
}