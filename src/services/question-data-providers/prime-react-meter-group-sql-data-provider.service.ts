import { Injectable } from "@nestjs/common";
import { DashboardQuestionDataProvider } from "src/decorators/dashboard-question-data-provider.decorator";
import { DashboardQuestion } from "src/entities/dashboard-question.entity";
import { IDashboardQuestionDataProvider } from "src/interfaces";
import { EntityManager } from "typeorm";
import { SqlExpressionResolverService } from "../sql-expression-resolver.service";
import { Logger } from '@nestjs/common';
import { SqlExpression } from "./chartjs-sql-data-provider.service";
import { getKpi } from "./helpers";

export interface QuestionSqlDataProviderContext {
    // questionSqlDatasetConfig: QuestionSqlDatasetConfig;
    // questionId: number;
    // question: Question;
}

@DashboardQuestionDataProvider()
@Injectable()
export class PrimeReactMeterGroupSqlDataProvider implements IDashboardQuestionDataProvider<QuestionSqlDataProviderContext, any> {
    private readonly logger = new Logger(PrimeReactMeterGroupSqlDataProvider.name);

    constructor(private readonly entityManager: EntityManager, private readonly sqlExpressionResolver: SqlExpressionResolverService) { }

    help(): string {
        return "Provides data for dashboard questions using a SQL dataset configuration. Configure your SQL dataset in the admin panel, then reference it in your dashboard question to fetch data.";
    }

    name(): string {
        return "PrimeReactMeterGroupSqlDataProvider";
    }

    hslToHex(h: number, s: number, l: number): string {
        l /= 100;
        s /= 100;

        const k = (n: number) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) =>
            Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));

        return `#${f(0).toString(16).padStart(2, '0')}${f(8).toString(16).padStart(2, '0')}${f(4)
            .toString(16)
            .padStart(2, '0')}`;
    }

    generateDistinctColors(count: number): string[] {
        const colors: string[] = [];

        const hueStep = 360 / count;
        const saturation = 65; // keep it vibrant
        const lightness = 55;  // balanced for both light/dark themes

        for (let i = 0; i < count; i++) {
            const hue = Math.round(i * hueStep);
            colors.push(this.hslToHex(hue, saturation, lightness));
        }

        return colors;
    }

    async getData(question: DashboardQuestion, expressions?: SqlExpression[], context?: QuestionSqlDataProviderContext): Promise<any> {
        // TODO: put some validation to check if the results of each SQL in each dataset returns the same number of rows 

        // This is what we have to return.
        // const values = [
        //     { label: 'Apps', color: '#34d399', value: 16 },
        //     { label: 'Messages', color: '#fbbf24', value: 8 },
        //     { label: 'Media', color: '#60a5fa', value: 24 },
        //     { label: 'System', color: '#c084fc', value: 10 }
        // ];

        // TODO: Load the set of labels by using a separate field on the question entity.

        const kpi: string = await getKpi(question, expressions, this.entityManager, this.sqlExpressionResolver);
        
        // Load the chart options as a JSON 
        const chartOptions = JSON.parse(question.chartOptions || '{}');

        const values = []

        // For meter group we can assume that we only have one sql dataset config.
        const questionSqlDatasetConfig = question.questionSqlDatasetConfigs[0];

        const sql = questionSqlDatasetConfig.sql;
        if (!sql) {
            throw new Error(`SQL dataset ${questionSqlDatasetConfig.datasetName} configuration does not contain a valid SQL query.`);
        }

        const sqlReplacementResult = this.sqlExpressionResolver.resolveSqlWithExpressions(sql, expressions || []);
        this.logger.debug(`Final Sql query for dataset [${questionSqlDatasetConfig.datasetName}] is query=[${sqlReplacementResult.rawSql}]`);
        this.logger.debug(`Final Sql query for dataset [${questionSqlDatasetConfig.datasetName}] is parameters=[${JSON.stringify(sqlReplacementResult.parameters)}]`);
        const results = await this.entityManager.query(sqlReplacementResult.rawSql, sqlReplacementResult.parameters);

        const colors = this.generateDistinctColors(results.length);

        // Also for each data set we create the dataset object as is expected by ChartJs.
        for (let i = 0; i < results.length; i++) {
            const result = results[i];

            const colorFromChartOptions = chartOptions?.colors?.[result[questionSqlDatasetConfig.labelColumnName]];
            const color = typeof colorFromChartOptions === 'string' ? colorFromChartOptions : colors[i];

            values.push({
                label: result[questionSqlDatasetConfig.labelColumnName],
                color: color,
                value: result[questionSqlDatasetConfig.valueColumnName]
            })
        }

        return {
            kpi,
            data: values, 
        };

    }
}