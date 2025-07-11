import { Injectable } from "@nestjs/common";
import { DashboardQuestionDataProvider } from "src/decorators/dashboard-question-data-provider.decorator";
import { Question } from "src/entities/question.entity";
import { IDashboardQuestionDataProvider } from "src/interfaces";
import { EntityManager } from "typeorm";
import { SqlExpressionResolverService } from "../sql-expression-resolver.service";

export interface QuestionSqlDataProviderContext {
    // questionSqlDatasetConfig: QuestionSqlDatasetConfig;
    // questionId: number;
    // question: Question;
}

export enum SqlExpressionOperator {
    EQUALS = '$equals',
    NOT_EQUALS = '$notEquals',
    CONTAINS = '$contains',
    NOT_CONTAINS = '$notContains',
    STARTS_WITH = '$startsWith',
    ENDS_WITH = '$endsWith',
    IN = '$in',
    NOT_IN = '$notIn',
    BETWEEN = '$between',
    LT = '$lt',
    LTE = '$lte',
    GT = '$gt',
    GTE = '$gte'
}

export interface SqlExpression {
    variableName : string; // The name of the variable in the SQL query
    operator: SqlExpressionOperator; // The operator to use for the replacement (e.g., '=', '>', '<', etc.)
    value: string[]; // The value to replace the variable with
}

@DashboardQuestionDataProvider()
@Injectable()
export class ChartJsSqlDataProvider implements IDashboardQuestionDataProvider<QuestionSqlDataProviderContext, any> {
    constructor(private readonly entityManager: EntityManager, private readonly sqlExpressionResolver: SqlExpressionResolverService) {}

    help(): string {
        return "Provides data for dashboard questions using a SQL dataset configuration. Configure your SQL dataset in the admin panel, then reference it in your dashboard question to fetch data.";
    }

    name(): string {
        return "ChartJsSqlDataProvider";
    }

    async getData(question: Question, expressions?: SqlExpression[], context?: QuestionSqlDataProviderContext): Promise<any> {
        // TODO: put some validation to check if the results of each SQL in each dataset returns the same number of rows 

        // This is what we have to return.
        // const data = {
        //     labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
        //     datasets: [
        //         {
        //             label: 'Dataset 1',
        //             data: labels.map(() => faker.number.int({ min: 0, max: 1000 })),
        //             backgroundColor: 'rgba(255, 99, 132, 0.5)',
        //         },
        //         {
        //             label: 'Dataset 2',
        //             data: labels.map(() => faker.number.int({ min: 0, max: 1000 })),
        //             backgroundColor: 'rgba(53, 162, 235, 0.5)',
        //         },
        //         {
        //             label: 'Dataset 3',
        //             data: labels.map(() => faker.number.int({ min: 0, max: 1000 })),
        //             backgroundColor: 'rgba(53, 235, 162, 0.5)',
        //         },
        //     ],
        // };

        // TODO: Load the set of labels by using a separate field on the question entity.

        let datasetIdx = 0;
        const datasets = [];
        const labels = [];
        // const question = context.question;
        for (const questionSqlDatasetConfig of question.questionSqlDatasetConfigs) {

            const sql = questionSqlDatasetConfig.sql;
            if (!sql) {
                throw new Error(`SQL dataset ${questionSqlDatasetConfig.datasetName} configuration does not contain a valid SQL query.`);
            }

            const sqlReplacementResult = this.sqlExpressionResolver.resolveSqlWithExpressions(sql, expressions || []);
            const results = await this.entityManager.query(sqlReplacementResult.rawSql, sqlReplacementResult.parameters);

            // If this is the first dataset being processed then we use the label_column to populate the labels array first. 
            if (datasetIdx === 0) {
                for (let i = 0; i < results.length; i++) {
                    const result = results[i];
                    labels.push(result[questionSqlDatasetConfig.labelColumnName]);
                }
            }

            // Also for each data set we create the dataset object as is expected by ChartJs.
            const data = [];
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                data.push(result[questionSqlDatasetConfig.valueColumnName]);
            }
            datasets.push({
                label: questionSqlDatasetConfig.datasetDisplayName,
                data: data,
                ...JSON.parse(questionSqlDatasetConfig.options || '{}'),
            });

            datasetIdx++;
        }

        return {
            labels,
            datasets
        };

    }
}