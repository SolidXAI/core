import { BadRequestException, Injectable, NotImplementedException } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { CRUDService } from 'src/services/crud.service';
import { FileService } from 'src/services/file.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';


import { SolidRegistry } from 'src/helpers/solid-registry';
import { Question } from '../entities/question.entity';
import { QuestionSqlDataProviderContext } from './question-data-providers/question-sql-data-provider.service';

enum SOURCE_TYPE {
  SQL = 'sql',
  PROVIDER = 'provider',
}

const SQL_DATA_PROVIDER_NAME = 'QuestionSqlDataProvider';


@Injectable()
export class QuestionService extends CRUDService<Question> {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(Question, 'default')
    readonly repo: Repository<Question>,
    readonly moduleRef: ModuleRef,
    readonly solidRegistry: SolidRegistry, // Assuming solidRegistry is injected for data providers

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'question', 'solid-core', moduleRef);
  }

  // Get the data for a specific question 
  async getData(id: number, query: any) {
    // Load the question
    const question = await this.loadQuestion(id);
    if (!question) {
      throw new BadRequestException(`Question with id ${id} not found`);
    }

    if (question.sourceType === SOURCE_TYPE.SQL) {
      const dataProvider = this.solidRegistry.getDashboardQuestionDataProviderInstance(SQL_DATA_PROVIDER_NAME);
      if (!dataProvider) {
        throw new BadRequestException(`No data provider with name ${SQL_DATA_PROVIDER_NAME} registered in backend.`);
      }

      const context: QuestionSqlDataProviderContext = {
        question,
      };
      return await dataProvider.getData(query, context);
      // dataset.push(data);

    }
    else {
      throw new NotImplementedException(`Data source type ${question.sourceType} not implemented. Only ${SOURCE_TYPE.SQL} is supported at the moment.`);
    }
    // return dataset;
  }

  private async loadQuestion(id: number) {
    const repo = this.entityManager.getRepository(Question);

    // Load the dashboard record using the field
    const question = await repo.findOne({
      where: {
        id,
      },
      relations: ['questionSqlDatasetConfigs']
    });
    return question;
  }

}
