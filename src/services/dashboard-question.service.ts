import { BadRequestException, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';


import { DashboardVariable } from 'src/entities/dashboard-variable.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { DashboardQuestion } from '../entities/dashboard-question.entity';
import { SqlExpression, SqlExpressionOperator } from './question-data-providers/chartjs-sql-data-provider.service';
import { DashboardQuestionRepository } from 'src/repository/dashboard-question.repository';
import { QuestionSqlDataProviderContext } from 'src';

enum SOURCE_TYPE {
  SQL = 'sql',
  PROVIDER = 'provider',
}

export const CHARTJS_SQL_DATA_PROVIDER_NAME = 'ChartJsSqlDataProvider';
export const PRIME_REACT_METER_GROUP_SQL_DATA_PROVIDER_NAME = 'PrimeReactMeterGroupSqlDataProvider';
export const PRIME_REACT_DATATABLE_SQL_DATA_PROVIDER_NAME = 'PrimeReactDatatableSqlDataProvider';

export const INBUILT_SQL_DATA_PROVIDERS = [CHARTJS_SQL_DATA_PROVIDER_NAME, PRIME_REACT_METER_GROUP_SQL_DATA_PROVIDER_NAME, PRIME_REACT_DATATABLE_SQL_DATA_PROVIDER_NAME];

@Injectable()
export class DashboardQuestionService extends CRUDService<DashboardQuestion> {
  private readonly logger = new Logger(this.constructor.name);
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(DashboardQuestion, 'default')
    // readonly repo: Repository<DashboardQuestion>,
    readonly repo: DashboardQuestionRepository,
    readonly moduleRef: ModuleRef,
    readonly solidRegistry: SolidRegistry, // Assuming solidRegistry is injected for data providers
  ) {
    super(entityManager, repo, 'dashboardQuestion', 'solid-core', moduleRef);
  }

  // Get the data for a specific question 
  async getData(id: number, inputExpressions: SqlExpression[] = [], isPreview = false): Promise<any> {
    // Load the question
    const question = await this.loadQuestion(id);
    if (!question) {
      throw new BadRequestException(`Question with id ${id} not found`);
    }

    // Get the dashbbard variables from the question
    const dashboardVariables = question.dashboard?.dashboardVariables || [];
    const expressions: SqlExpression[] = this.getExpressions(isPreview, dashboardVariables, inputExpressions);

    // Try to resolve the dataProvider based on a combination of sourceType and visualisedAs
    let dataProvider = null;
    let context = {};

    // Decide which data provider to use based on the question visualisation type if sourceType is SQL. 
    if (question.sourceType === SOURCE_TYPE.SQL && ['bar', 'pie', 'line', 'donut'].includes(question.visualisedAs)) {
      dataProvider = this.solidRegistry.getDashboardQuestionDataProviderInstance(CHARTJS_SQL_DATA_PROVIDER_NAME);
      context = {
        expressions,
      } as QuestionSqlDataProviderContext;
    }
    if (question.sourceType === SOURCE_TYPE.SQL && ['prime-meter-group'].includes(question.visualisedAs)) {
      dataProvider = this.solidRegistry.getDashboardQuestionDataProviderInstance(PRIME_REACT_METER_GROUP_SQL_DATA_PROVIDER_NAME);
            context = {
        expressions,
      } as QuestionSqlDataProviderContext;
    }
    if (question.sourceType === SOURCE_TYPE.SQL && ['prime-datatable'].includes(question.visualisedAs)) {
      dataProvider = this.solidRegistry.getDashboardQuestionDataProviderInstance(PRIME_REACT_DATATABLE_SQL_DATA_PROVIDER_NAME);
      context = {
        expressions,
      } as QuestionSqlDataProviderContext;
    }

    // If a custom provider is specified, use that one instead
    if (question.sourceType === SOURCE_TYPE.PROVIDER) {
      dataProvider = this.solidRegistry.getDashboardQuestionDataProviderInstance(question.providerName);
    }

    if (!dataProvider) {
      throw new NotImplementedException(`Invalid data source type ${question.sourceType}`);
    }

    return await dataProvider.getData(question, context);

  }

  private getExpressions(isPreview: boolean, dashboardVariables: DashboardVariable[], inputExpressions: SqlExpression[]) {
    const expressions: SqlExpression[] = [];

    if (isPreview) {
      // Convert the dashboard variables into objects of interface type SqlExpression using the default value, default operator and the variable name
      const expr: SqlExpression[] = dashboardVariables.map(variable => {
        return {
          variableName: variable.variableName,
          operator: variable.defaultOperator as SqlExpressionOperator, // Assuming defaultOperator is a valid SqlExpressionOperator
          value: JSON.parse(variable.defaultValue || '[]'), // Assuming defaultValue is a string or can be converted to a string array
        };
      });
      expressions.push(...expr);
    }
    else {
      // Loop through the dashboard variables and see if there is a matching input expression
      // If there is, use that expression instead of the default value
      for (const variable of dashboardVariables) {
        const matchingInputExpression = inputExpressions.find(expr => expr.variableName === variable.variableName);
        if (matchingInputExpression) {
          expressions.push(matchingInputExpression);
        }
        else {
          expressions.push({
            variableName: variable.variableName,
            operator: variable.defaultOperator as SqlExpressionOperator,
            value: JSON.parse(variable.defaultValue || '[]'),
          });
        }
      }
      expressions.push(...expressions);
    }

    // Remove duplicate expressions based on variableName in the expressions array
    const deduplicatedExpressions: SqlExpression[] = [];
    const variableNames = new Set<string>();
    for (const expr of expressions) {
      if (!variableNames.has(expr.variableName)) {
        deduplicatedExpressions.push(expr);
        variableNames.add(expr.variableName);
      }
    }

    return deduplicatedExpressions;
  }

  private async loadQuestion(id: number) {
    const repo = this.entityManager.getRepository(DashboardQuestion);

    // Load the dashboard record using the field
    const question = await repo.findOne({
      where: {
        id,
      },
      relations: ['questionSqlDatasetConfigs', 'dashboard', 'dashboard.dashboardVariables'],
    });
    return question;
  }

}
