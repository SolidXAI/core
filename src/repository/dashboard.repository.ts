import { Injectable } from "@nestjs/common";
import { Dashboard } from "src/entities/dashboard.entity";
import { ModuleMetadata } from "src/entities/module-metadata.entity";
import { RequestContextService } from "src/services/request-context.service";
import { DataSource } from "typeorm";
import { SecurityRuleRepository } from "./security-rule.repository";
import { SolidBaseRepository } from "./solid-base.repository";

@Injectable()
export class DashboardRepository extends SolidBaseRepository<Dashboard> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(Dashboard, dataSource, requestContextService, securityRuleRepository);
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