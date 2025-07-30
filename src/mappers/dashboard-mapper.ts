import { Injectable } from "@nestjs/common";
import { SelectionDynamicSourceType } from "src/dtos/create-dashboard-variable.dto";
import { Dashboard } from "src/entities/dashboard.entity";

@Injectable()
export class DashboardMapper {
    toDto(dashboard: Dashboard): any {
        return {
            name: dashboard.name,
            layoutJson: this.safeParseJSON(dashboard.layoutJson, {}),
            moduleUserKey: dashboard.module?.name ?? null, // safer fallback

            dashboardVariables: (dashboard.dashboardVariables || []).map(variable => ({
                variableName: variable.variableName,
                variableType: variable.variableType,
                selectionStaticValues: this.safeParseJSON(variable.selectionStaticValues, []),
                selectionDynamicSourceType: variable.selectionDynamicSourceType as SelectionDynamicSourceType,
                selectionDynamicSQL: variable.selectionDynamicSQL ?? null,
                selectionDynamicProviderName: variable.selectionDynamicProviderName ?? null,
                defaultValue: this.safeParseJSON(variable.defaultValue, []),
                defaultOperator: variable.defaultOperator ?? null,
            })),
            questions: (dashboard.questions || []).map(question => ({
                name: question.name,
                sourceType: question.sourceType,
                visualisedAs: question.visualisedAs,
                providerName: question.providerName ?? null,
                chartOptions: question.chartOptions ?? null,
                labelSql: question.labelSql ?? null,
                kpiSql: question.kpiSql ?? null,
                externalId: question.externalId,
                questionSqlDatasetConfigs: (question.questionSqlDatasetConfigs || []).map(config => ({
                    sql: config.sql,
                    datasetName: config.datasetName,
                    datasetDisplayName: config.datasetDisplayName, // 🔧 fixed typo: `daataSetDisplayName`
                    description: config.description,
                    labelColumnName: config.labelColumnName,
                    valueColumnName: config.valueColumnName,
                    options: this.safeParseJSON(config.options, {}),
                    externalId: config.externalId
                }))
            }))
        };
    }

    private safeParseJSON(json: string | null | undefined, fallback: any): any {
        try {
            return json ? JSON.parse(json) : fallback;
        } catch {
            return fallback;
        }
    }
}