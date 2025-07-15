import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import e from "express";
import { DashboardVariable } from "src/entities/dashboard-variable.entity";
import { Dashboard } from "src/entities/dashboard.entity";
import { Question } from "src/entities/question.entity";
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { DashboardService } from "src/services/dashboard.service";
import { QuestionService } from "src/services/question.service";
import { EntitySubscriberInterface, DataSource, InsertEvent, UpdateEvent, EntityManager } from "typeorm";

@Injectable()
export class QuestionSubscriber implements EntitySubscriberInterface<Question> {
    private readonly logger = new Logger(this.constructor.name);
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        readonly moduleMetadataHelperService: ModuleMetadataHelperService,
        readonly dashboardService: DashboardService,
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return Question;
    }

    async afterInsert(event: InsertEvent<Question>) {
        await this.saveDashboardToConfig(event.entity.dashboard, event.queryRunner.manager);
    }

    async afterUpdate(event: UpdateEvent<Question>) {
        await this.saveDashboardToConfig(event.databaseEntity.dashboard, event.queryRunner.manager);
    }

    private async saveDashboardToConfig(dashboard: Dashboard, entityManager: EntityManager): Promise<void> {
        // Get the dashboard from the question & call the saveDashboardToConfig method
        if (!dashboard) {
            throw new Error('Dashboard not found in the DashboardVariableService saveDashboardToConfig method');
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