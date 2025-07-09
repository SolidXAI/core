import { Injectable } from "@nestjs/common";
import { DashboardQuestionDataProvider } from "src/decorators/dashboard-question-data-provider.decorator";
import { QuestionSqlDatasetConfig } from "src/entities/question-sql-dataset-config.entity";
import { IDashboardQuestionDataProvider } from "src/interfaces";
import { EntityManager } from "typeorm";

export interface QuestionSqlDataProviderContext {
    questionSqlDatasetConfig: QuestionSqlDatasetConfig;
}

@DashboardQuestionDataProvider()
@Injectable()
export class QuestionSqlDataProvider implements IDashboardQuestionDataProvider<QuestionSqlDataProviderContext, any> {
    constructor(private readonly entityManager: EntityManager) {
    }
    help(): string {
        return "Provides data for dashboard questions using a SQL dataset configuration. Configure your SQL dataset in the admin panel, then reference it in your dashboard question to fetch data.";
    }

    name(): string {
        return "QuestionSqlDataProvider";
    }

    async getData(query: any, context: QuestionSqlDataProviderContext): Promise<any[]> {
        // Get the SQL dataset configuration from the context
        const sqlDatasetConfig = context.questionSqlDatasetConfig;
        if (!sqlDatasetConfig) {
            throw new Error("No SQL dataset configuration provided in the context.");
        }
        const sql = sqlDatasetConfig.sql;
        if (!sql) {
            throw new Error("SQL dataset configuration does not contain a valid SQL query.");
        }

        const results = await this.entityManager.query(sql);

        // Transform the results into the expected format
        return results.map((result: any) => {
            const transformedResult: any = {
                // Assuming the result has a 'value' and 'label' field, adjust as necessary
                value: result.value,
                label: result.label,
                // Add any other fields you need to transform here
            };
            return transformedResult;
        }
        );
    }
}