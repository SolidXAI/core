import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DashboardQuestion } from "src/entities/dashboard-question.entity";
import { Dashboard } from "src/entities/dashboard.entity";
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { DashboardService } from "src/services/dashboard.service";
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, UpdateEvent } from "typeorm";

@Injectable()
export class DashboardQuestionSubscriber implements EntitySubscriberInterface<DashboardQuestion> {
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
        return DashboardQuestion;
    }

    async afterInsert(event: InsertEvent<DashboardQuestion>) {
        if (!event.entity) {
            this.logger.debug('No question entity found in the QuestionSubscriber afterInsert method');
            return;
        }
        await this.saveDashboardToConfig(event.entity, event.queryRunner.manager);
    }

    async afterUpdate(event: UpdateEvent<DashboardQuestion>) {
        if (!event.databaseEntity) {
            this.logger.debug('No question entity found in the QuestionSubscriber afterUpdate method');
            return;
        }
        await this.saveDashboardToConfig(event.databaseEntity, event.queryRunner.manager);
    }

    private async saveDashboardToConfig(question: DashboardQuestion, entityManager: EntityManager): Promise<void> {
        const dashboard = question.dashboard;
        // Get the dashboard from the question & call the saveDashboardToConfig method
        if (!dashboard) {
            this.logger.debug(`Dashboard is undefined for question id ${question.id}`);
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