import { Logger } from "@nestjs/common";
import { CreateDashboardDto } from "src/dtos/create-dashboard.dto";
import { DashboardVariable } from "src/entities/dashboard-variable.entity";
import { Dashboard } from "src/entities/dashboard.entity";
import { ModuleMetadata } from "src/entities/module-metadata.entity";
import { QuestionSqlDatasetConfig } from "src/entities/question-sql-dataset-config.entity";
import { Question } from "src/entities/question.entity";
import { DataSource, Repository } from "typeorm";

export class DashboardRepository extends Repository<Dashboard> {
    private readonly logger = new Logger(this.constructor.name);
    constructor(
        private dataSource: DataSource,
    ) {
        super(Dashboard, dataSource.createEntityManager());
    }


    async upsertWithDto(createDto: CreateDashboardDto) {
        const moduleMetadataRepository = this.dataSource.getRepository(ModuleMetadata);
        const module = await moduleMetadataRepository.findOneBy({ name: createDto.moduleUserKey });

        if (!module) throw new Error(`Module with key ${createDto.moduleUserKey} not found`);

        const existingDashboard = await this.findOne({
            where: { name: createDto.name },
            relations: ['dashboardVariables', 'questions', 'questions.questionSqlDatasetConfigs'],
        });

        const dashboardData = {
            ...createDto,
            module,
            layoutJson: JSON.stringify(createDto.layoutJson ?? {}),
            dashboardVariables: createDto.dashboardVariables?.map(variable => ({
                ...variable,
                selectionStaticValues: JSON.stringify(variable.selectionStaticValues ?? []),
            })),
            questions: createDto.questions?.map(question => ({
                ...question,
                questionSqlDatasetConfigs: question.questionSqlDatasetConfigs?.map(cfg => ({
                    ...cfg,
                    options: JSON.stringify(cfg.options ?? {}),
                })),
            })),
        };

        if (existingDashboard) {
            // Optionally clean up stale children
            await this.cleanupRemovedRelations(existingDashboard, createDto);

            this.merge(existingDashboard, dashboardData);
            return this.save(existingDashboard);
        } else {
            const newDashboard = this.create(dashboardData);
            return this.save(newDashboard);
        }
    }

    private async cleanupRemovedRelations(existing: Dashboard, dto: CreateDashboardDto) {
        const dashboardVariableRepo = this.dataSource.getRepository(DashboardVariable);
        const questionRepo = this.dataSource.getRepository(Question);
        const datasetConfigRepo = this.dataSource.getRepository(QuestionSqlDatasetConfig); // 👈 make sure this is imported

        // === 1. Clean up removed dashboardVariables ===
        const dtoVariableNames = new Set(dto.dashboardVariables.map(v => v.variableName));
        const variablesToRemove = existing.dashboardVariables.filter(
            v => !dtoVariableNames.has(v.variableName)
        );
        if (variablesToRemove.length > 0) {
            await dashboardVariableRepo.remove(variablesToRemove);
        }

        // === 2. Clean up removed questions and gather removed question IDs ===
        const dtoQuestionNames = new Set(dto.questions.map(q => q.name));
        const questionsToRemove = existing.questions.filter(
            q => !dtoQuestionNames.has(q.name)
        );

        if (questionsToRemove.length > 0) {
            await questionRepo.remove(questionsToRemove);
        }

        // === 3. Clean up removed questionSqlDatasetConfigs from existing (retained) questions ===
        for (const existingQuestion of existing.questions) {
            const dtoQuestion = dto.questions.find(q => q.name === existingQuestion.name);
            if (!dtoQuestion) continue;

            const dtoDatasetNames = new Set(dtoQuestion.questionSqlDatasetConfigs?.map(cfg => cfg.datasetName));
            const configsToRemove = existingQuestion.questionSqlDatasetConfigs.filter(
                cfg => !dtoDatasetNames.has(cfg.datasetName)
            );

            if (configsToRemove.length > 0) {
                await datasetConfigRepo.remove(configsToRemove);
            }
        }
    }
}