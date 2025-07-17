import { Injectable, Logger } from "@nestjs/common";
import { CreateDashboardDto } from "src/dtos/create-dashboard.dto";
import { DashboardVariable } from "src/entities/dashboard-variable.entity";
import { Dashboard } from "src/entities/dashboard.entity";
import { ModuleMetadata } from "src/entities/module-metadata.entity";
import { DashboardQuestionSqlDatasetConfig } from "src/entities/dashboard-question-sql-dataset-config.entity";
import { DashboardQuestion } from "src/entities/dashboard-question.entity";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class DashboardRepository extends Repository<Dashboard> {
    private readonly logger = new Logger(this.constructor.name);
    constructor(
        private dataSource: DataSource,
    ) {
        super(Dashboard, dataSource.createEntityManager());
    }


    async upsertWithDto(createDto: any) {
        const moduleMetadataRepository = this.dataSource.getRepository(ModuleMetadata);
        const module = await moduleMetadataRepository.findOneBy({ name: createDto.moduleUserKey });

        if (!module) throw new Error(`Module with key ${createDto.moduleUserKey} not found`);

        const existingDashboard = await this.findOne({
            where: { name: createDto.name },
            relations: ['dashboardVariables', 'questions', 'questions.questionSqlDatasetConfigs'],
        });

        if (existingDashboard) {
            // Update basic fields
            existingDashboard.layoutJson = JSON.stringify(createDto.layoutJson ?? {});
            existingDashboard.module = module;

            // Upsert dashboard variables
            existingDashboard.dashboardVariables = createDto.dashboardVariables?.map(variable => {
                const existingVar = existingDashboard.dashboardVariables.find(v => v.variableName === variable.variableName);
                if (existingVar) {
                    return Object.assign(existingVar, {
                        ...variable,
                        selectionStaticValues: JSON.stringify(variable.selectionStaticValues ?? []),
                        defaultValue: JSON.stringify(variable.defaultValue ?? []),
                    });
                }
                return {
                    ...variable,
                    selectionStaticValues: JSON.stringify(variable.selectionStaticValues ?? []),
                    defaultValue: JSON.stringify(variable.defaultValue ?? []),
                };
            }) ?? [];

            // Upsert questions and their configs
            existingDashboard.questions = createDto.questions?.map(question => {
                const existingQuestion = existingDashboard.questions.find(q => q.name === question.name);
                const questionData: any = {
                    ...question,
                    questionSqlDatasetConfigs: question.questionSqlDatasetConfigs?.map(cfg => {
                        const existingCfg = existingQuestion?.questionSqlDatasetConfigs.find(c => c.datasetName === cfg.datasetName);
                        if (existingCfg) {
                            return Object.assign(existingCfg, {
                                ...cfg,
                                options: JSON.stringify(cfg.options ?? {}),
                            });
                        }
                        return {
                            ...cfg,
                            options: JSON.stringify(cfg.options ?? {}),
                        };
                    }) ?? [],
                };

                return existingQuestion ? Object.assign(existingQuestion, questionData) : questionData;
            }) ?? [];

            return this.save(existingDashboard);
        }

        // Else: new dashboard
        const dashboardData = {
            ...createDto,
            module,
            layoutJson: JSON.stringify(createDto.layoutJson ?? {}),
            dashboardVariables: createDto.dashboardVariables?.map(variable => ({
                ...variable,
                selectionStaticValues: JSON.stringify(variable.selectionStaticValues ?? []),
                defaultValue: JSON.stringify(variable.defaultValue ?? []),
            })),
            questions: createDto.questions?.map(question => ({
                ...question,
                questionSqlDatasetConfigs: question.questionSqlDatasetConfigs?.map(cfg => ({
                    ...cfg,
                    options: JSON.stringify(cfg.options ?? {}),
                })),
            })),
        };

        const newDashboard = this.create(dashboardData);
        return this.save(newDashboard);
    }
}