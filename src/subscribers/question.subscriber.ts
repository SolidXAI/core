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
        if (!event.entity) {
            this.logger.debug('No question entity found in the QuestionSubscriber afterInsert method');
            return;
        }
        await this.saveDashboardToConfig(event.entity, event.queryRunner.manager);
    }

    async afterUpdate(event: UpdateEvent<Question>) {
        if (!event.databaseEntity) {
            this.logger.debug('No question entity found in the QuestionSubscriber afterUpdate method');
            return;
        }
        await this.saveDashboardToConfig(event.databaseEntity, event.queryRunner.manager);
    }

    private async saveDashboardToConfig(question: Question, entityManager: EntityManager): Promise<void> {
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