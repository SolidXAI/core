import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { Dashboard } from "src/entities/dashboard.entity";
import { QuestionSqlDatasetConfig } from "src/entities/question-sql-dataset-config.entity";
import { Question } from "src/entities/question.entity";
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { DashboardService } from "src/services/dashboard.service";
import { QuestionService } from "src/services/question.service";
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, UpdateEvent } from "typeorm";

@Injectable()
export class QuestionSqlDatasetConfigSubscriber implements EntitySubscriberInterface<QuestionSqlDatasetConfig> {
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
        return QuestionSqlDatasetConfig;
    }

    async afterInsert(event: InsertEvent<QuestionSqlDatasetConfig>) {
        const question = event.entity.question;
        if (!question) {
            this.logger.debug('No question found in the QuestionSqlDatasetConfigSubscriber afterInsert method');
            return;
        }
        await this.saveQuestionToConfig(question, event.queryRunner.manager);
    }

    async afterUpdate(event: UpdateEvent<QuestionSqlDatasetConfig>) {
        const question = event.databaseEntity.question;
        if (!question) {
            this.logger.debug('No question found in the QuestionSqlDatasetConfigSubscriber afterUpdate method');
            return;
        }
        await this.saveQuestionToConfig(question, event.queryRunner.manager);
    }

    private async saveQuestionToConfig(question: Question, entityManager: EntityManager): Promise<void> {
        // Populate the dashboard for the question
        const populatedQuestion = await entityManager.findOne(Question, {
            where: {
                id: question.id,
            },
            relations: ['dashboard', 'dashboard.module', 'dashboard.dashboardVariables', 'dashboard.questions', 'dashboard.questions.questionSqlDatasetConfigs'],
        });
        const dashboard = populatedQuestion?.dashboard;

        if (!dashboard) {
            throw new Error(`Dashboard not found for question id ${question.id}`);
        }

        // Call the saveDashboardToConfig method from the DashboardService
        await this.dashboardService.saveDashboardToConfig(dashboard);
    }

}