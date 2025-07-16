import { Injectable } from "@nestjs/common";
import { DashboardQuestionDataProvider } from "src/decorators/dashboard-question-data-provider.decorator";
import { DashboardQuestion } from "src/entities/dashboard-question.entity";
import { IDashboardQuestionDataProvider } from "src/interfaces";
import { EntityManager } from "typeorm";
import { SqlExpressionResolverService } from "../sql-expression-resolver.service";
import { Logger } from '@nestjs/common';
import { SqlExpression } from "./chartjs-sql-data-provider.service";

export interface QuestionSqlDataProviderContext {
    // questionSqlDatasetConfig: QuestionSqlDatasetConfig;
    // questionId: number;
    // question: Question;
}

@DashboardQuestionDataProvider()
@Injectable()
export class PrimeReactDatatableSqlDataProvider implements IDashboardQuestionDataProvider<QuestionSqlDataProviderContext, any> {
    private readonly logger = new Logger(PrimeReactDatatableSqlDataProvider.name);

    constructor(private readonly entityManager: EntityManager, private readonly sqlExpressionResolver: SqlExpressionResolverService) { }

    help(): string {
        return "Provides data for dashboard questions using a SQL dataset configuration. Configure your SQL dataset in the admin panel, then reference it in your dashboard question to fetch data.";
    }

    name(): string {
        return "PrimeReactDatatableSqlDataProvider";
    }

    async getData(question: DashboardQuestion, expressions?: SqlExpression[], context?: QuestionSqlDataProviderContext): Promise<any> {
        // TODO: put some validation to check if the results of each SQL in each dataset returns the same number of rows 

        // Check the expected response for prime react data tables to understand what is going on here...

        // TODO: Load the set of labels by using a separate field on the question entity.
        const labelSql = question.labelSql;
        const labelResults = await this.entityManager.query(labelSql);
        const columns = [];
        for (let i = 0; i < labelResults.length; i++) {
            const labelResult = labelResults[i];
            columns.push({
                field: labelResult['field'],
                header: labelResult['header'],
            });
        }

        // Load the chart options as a JSON 
        // const chartOptions = JSON.parse(question.barChartLabelOptions || '{}');

        const values = []

        // For meter group we can assume that we only have one sql dataset config.
        const questionSqlDatasetConfig = question.questionSqlDatasetConfigs[0];

        const sql = questionSqlDatasetConfig.sql;
        if (!sql) {
            throw new Error(`SQL dataset ${questionSqlDatasetConfig.datasetName} configuration does not contain a valid SQL query.`);
        }

        const sqlReplacementResult = this.sqlExpressionResolver.resolveSqlWithExpressions(sql, expressions || []);
        this.logger.log(`Final Sql query for dataset [${questionSqlDatasetConfig.datasetName}] is query=[${sqlReplacementResult.rawSql}]`);
        this.logger.log(`Final Sql query for dataset [${questionSqlDatasetConfig.datasetName}] is parameters=[${JSON.stringify(sqlReplacementResult.parameters)}]`);
        const results = await this.entityManager.query(sqlReplacementResult.rawSql, sqlReplacementResult.parameters);

        return {
            columns,
            data: results,
        };

    }
}