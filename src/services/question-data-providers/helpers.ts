import { DashboardQuestion } from "src/entities/dashboard-question.entity";
import { EntityManager } from "typeorm";
import { SqlExpression } from "./chartjs-sql-data-provider.service";
import { SqlExpressionResolverService } from "../sql-expression-resolver.service";

export async function getLabels(question: DashboardQuestion, expressions: SqlExpression[], entityManager: EntityManager, sqlExpressionResolver: SqlExpressionResolverService): Promise<string[]> {
    const sql = question.labelSql;
    if (!sql) {
        return [];
    } 
    const sqlReplacementResult = sqlExpressionResolver.resolveSqlWithExpressions(sql, expressions || []);
   
    const labelResults = await entityManager.query(sqlReplacementResult.rawSql, sqlReplacementResult.parameters);
    
    // Assuming labelResults has a single row with a 'label' field
    // Map the label results to the labels array
    const labels: string[] = labelResults.map((result: { [x: string]: string; }) => result['label']);
    return labels;
}

export async function getKpi(question: DashboardQuestion, expressions: SqlExpression[], entityManager: EntityManager, sqlExpressionResolver: SqlExpressionResolverService): Promise<string> {
    const sql = question.kpiSql;
    if (!sql) {
        return "";
    }
    const sqlReplacementResult = sqlExpressionResolver.resolveSqlWithExpressions(sql, expressions || []);
    const result = await entityManager.query(sqlReplacementResult.rawSql, sqlReplacementResult.parameters);
    const kpiResult = result.pop();
    return kpiResult?.kpi || "";
}