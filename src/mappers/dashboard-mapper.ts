import { Injectable } from "@nestjs/common";
import { SelectionDynamicSourceType } from "src/dtos/create-dashboard-variable.dto";
import { Dashboard } from "src/entities/dashboard.entity";

@Injectable()
export class DashboardMapper {
    // Create a toDto method which maps the Dashboard entity to a DTO
    // This dto will be written to a config file and can be used to seed any forthcoming changes to the dashboard
    // ids of the main entity and child entities will be removed
    // parent entities will be removed
    toDto(dashboard: Dashboard): any {
        return {
            name: dashboard.name,
            layoutJson: JSON.parse(dashboard.layoutJson ?? "{}"),
            moduleUserKey: dashboard.module.name, // Assuming you want to keep the module ID
            dashboardVariables: dashboard.dashboardVariables.map(variable => ({
                name: variable.variableName,
                type: variable.variableType,
                selectionStaticValues: JSON.parse(variable.selectionStaticValues ?? "[]"),
                selectionDynamicSourceType: variable.selectionDynamicSourceType as SelectionDynamicSourceType,
                selectionDynamicSQL: variable.selectionDynamicSQL,
                selectionDynamicProviderName: variable.selectionDynamicProviderName,
                defaultValue: variable.defaultValue,
                defaultOperator: variable.defaultOperator,
            })),
            questions: dashboard.questions.map(question => ({
                name: question.name,
                sourceType: question.sourceType,
                visualisedAs: question.visualisedAs,
                providerName: question.providerName,
                chartOptions: question.chartOptions,
                labelSql: question.labelSql,
                kpiSql: question.kpiSql,
                questionSqlDatasetConfigs: question.questionSqlDatasetConfigs.map(config => ({
                    sql: config.sql,
                    datasetName: config.datasetName,
                    daataSetDisplayName: config.datasetDisplayName,
                    datasetDescription: config.description,
                    labelColumnName: config.labelColumnName,
                    valueColumnName: config.valueColumnName,
                    options: JSON.parse(config.options ?? "{}")
                })),
            }))
        }
    }
}