import { BadRequestException, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { CRUDService } from 'src/services/crud.service';
import { FileService } from 'src/services/file.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';


import { DashboardVariable } from 'src/entities/dashboard-variable.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { DashboardQuestion } from '../entities/dashboard-question.entity';
import { SqlExpression, SqlExpressionOperator } from './question-data-providers/chartjs-sql-data-provider.service';
import { DashboardService } from './dashboard.service';
import { Dashboard } from 'src/entities/dashboard.entity';

enum SOURCE_TYPE {
  SQL = 'sql',
  PROVIDER = 'provider',
}

const CHARTJS_SQL_DATA_PROVIDER_NAME = 'ChartJsSqlDataProvider';
const PRIME_REACT_METER_GROUP_SQL_DATA_PROVIDER_NAME = 'PrimeReactMeterGroupSqlDataProvider';
const PRIME_REACT_DATATABLE_SQL_DATA_PROVIDER_NAME = 'PrimeReactDatatableSqlDataProvider';

@Injectable()
export class DashboardQuestionService extends CRUDService<DashboardQuestion> {
  private readonly logger = new Logger(this.constructor.name);
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(DashboardQuestion, 'default')
    readonly repo: Repository<DashboardQuestion>,
    readonly moduleRef: ModuleRef,
    readonly solidRegistry: SolidRegistry, // Assuming solidRegistry is injected for data providers
  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'dashboardQuestion', 'solid-core', moduleRef);
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

    if (question.sourceType === SOURCE_TYPE.SQL && ['bar', 'pie', 'line', 'donut'].includes(question.visualisedAs)) {
      dataProvider = this.solidRegistry.getDashboardQuestionDataProviderInstance(CHARTJS_SQL_DATA_PROVIDER_NAME);
    }
    if (question.sourceType === SOURCE_TYPE.SQL && ['prime-meter-group'].includes(question.visualisedAs)) {
      dataProvider = this.solidRegistry.getDashboardQuestionDataProviderInstance(PRIME_REACT_METER_GROUP_SQL_DATA_PROVIDER_NAME);
    }
    if (question.sourceType === SOURCE_TYPE.SQL && ['prime-datatable'].includes(question.visualisedAs)) {
      dataProvider = this.solidRegistry.getDashboardQuestionDataProviderInstance(PRIME_REACT_DATATABLE_SQL_DATA_PROVIDER_NAME);
    }

    if (!dataProvider) {
      throw new NotImplementedException(`Invalid data source type ${question.sourceType}`);
    }

    return await dataProvider.getData(question, expressions);

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
      expressions.push(...inputExpressions);
    }
    return expressions;
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
