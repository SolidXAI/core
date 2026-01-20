import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from "@nestjs/core";
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';


import { DashboardQuestionSqlDatasetConfig } from '../entities/dashboard-question-sql-dataset-config.entity';
import { DashboardQuestionSqlDatasetConfigRepository } from 'src/repository/dashboard-question-sql-dataset-config.repository';

@Injectable()
export class DashboardQuestionSqlDatasetConfigService extends CRUDService<DashboardQuestionSqlDatasetConfig>{
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(DashboardQuestionSqlDatasetConfig, 'default')
    // readonly repo: Repository<DashboardQuestionSqlDatasetConfig>,
    readonly repo: DashboardQuestionSqlDatasetConfigRepository,
    readonly moduleRef: ModuleRef

 ) {
   super(entityManager, repo, 'dashboardQuestionSqlDatasetConfig', 'solid-core', moduleRef);
 }
}
