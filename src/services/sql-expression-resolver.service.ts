import { Injectable } from "@nestjs/common";
import { SqlExpression, SqlExpressionOperator } from "./question-data-providers/chartjs-sql-data-provider.service";
import { RequestContextService } from "./request-context.service";
import { ERROR_MESSAGES } from "src/constants/error-messages";

export interface SqlReplacementResult {
  rawSql: string;
  parameters: any[]; // Positional parameters
}

@Injectable()
export class SqlExpressionResolverService {
  constructor(private readonly requestContextService: RequestContextService) { }
  resolveSqlWithExpressions(sql: string, expressions: SqlExpression[]): SqlReplacementResult {
    const variableToColumnMap: Record<string, string> = {};
    const variablePattern = /{{\s*(\w+)\s*\[\s*([\w.]+)\s*\]\s*}}/g;

    let paramIndex = 1;
    const parameters: any[] = [];

    // Handle sql expression tokens like {{$activeUserId}} in the SQL string
    if (sql.includes('{{$activeUserId}}')) {
      const activeUser = this.requestContextService.getActiveUser();
      if (activeUser && activeUser.sub) {
        // Replace custom placeholder with parameter placeholder ($1)
        sql = sql.replace(/\{\{\$activeUserId\}\}/g, `$${paramIndex++}`);
        // Add the active user ID to parameters
        parameters.push(activeUser.sub);
      }
    }

    // --- Pass 1: extract variable -> column mappings ---
    let simplifiedSql = sql.replace(variablePattern, (_, variableName, columnName) => {
      variableToColumnMap[variableName] = columnName;
      return `{{${variableName}}}`;
    });

    // --- Pass 2: Replace each variable with positional fragment ---

    for (const expr of expressions) {
      const column = variableToColumnMap[expr.variableName];
      if (!column) continue;

      let sqlFragment = '';
      const placeholder = `{{${expr.variableName}}}`;

      switch (expr.operator) {
        case SqlExpressionOperator.EQUALS:
          sqlFragment = `${column} = $${paramIndex++}`;
          parameters.push(expr.value[0]);
          break;

        case SqlExpressionOperator.NOT_EQUALS:
          sqlFragment = `${column} != $${paramIndex++}`;
          parameters.push(expr.value[0]);
          break;

        case SqlExpressionOperator.CONTAINS:
          sqlFragment = `${column} LIKE $${paramIndex++}`;
          parameters.push(`%${expr.value[0]}%`);
          break;

        case SqlExpressionOperator.NOT_CONTAINS:
          sqlFragment = `${column} NOT LIKE $${paramIndex++}`;
          parameters.push(`%${expr.value[0]}%`);
          break;

        case SqlExpressionOperator.STARTS_WITH:
          sqlFragment = `${column} LIKE $${paramIndex++}`;
          parameters.push(`${expr.value[0]}%`);
          break;

        case SqlExpressionOperator.ENDS_WITH:
          sqlFragment = `${column} LIKE $${paramIndex++}`;
          parameters.push(`%${expr.value[0]}`);
          break;

        case SqlExpressionOperator.IN:
          const inParams = expr.value.map(val => {
            parameters.push(val);
            return `$${paramIndex++}`;
          });
          sqlFragment = `${column} IN (${inParams.join(", ")})`;
          break;

        case SqlExpressionOperator.NOT_IN:
          const notInParams = expr.value.map(val => {
            parameters.push(val);
            return `$${paramIndex++}`;
          });
          sqlFragment = `${column} NOT IN (${notInParams.join(", ")})`;
          break;

        case SqlExpressionOperator.BETWEEN:
          sqlFragment = `${column} BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
          parameters.push(expr.value[0], expr.value[1]);
          paramIndex += 2;
          break;

        case SqlExpressionOperator.LT:
          sqlFragment = `${column} < $${paramIndex++}`;
          parameters.push(expr.value[0]);
          break;

        case SqlExpressionOperator.LTE:
          sqlFragment = `${column} <= $${paramIndex++}`;
          parameters.push(expr.value[0]);
          break;

        case SqlExpressionOperator.GT:
          sqlFragment = `${column} > $${paramIndex++}`;
          parameters.push(expr.value[0]);
          break;

        case SqlExpressionOperator.GTE:
          sqlFragment = `${column} >= $${paramIndex++}`;
          parameters.push(expr.value[0]);
          break;

        default:
          throw new Error(ERROR_MESSAGES.UNSUPPORTED_SQL_OPERATOR(expr.operator));
      }
      simplifiedSql = simplifiedSql.replace(placeholder, sqlFragment);
    }

    // --- Final cleanup: remove any remaining placeholders ---
    simplifiedSql = simplifiedSql.replace(/{{\s*\w+\s*}}/g, '');

    // Remove dangling where clause if no expressions were applied
    simplifiedSql = simplifiedSql.replace(/\bwhere\b\s*$/i, '').trim();

    // Need to handle scenarios of complex expression i.e with and / or clauses. probably need to have this logic in the sql expression object itself


    return {
      rawSql: simplifiedSql,
      parameters
    };
  }
}