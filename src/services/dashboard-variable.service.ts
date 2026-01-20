import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';


import { DashboardVariable } from '../entities/dashboard-variable.entity';
import { DashboardVariableRepository } from 'src/repository/dashboard-variable.repository';

@Injectable()
export class DashboardVariableService extends CRUDService<DashboardVariable> {
  private readonly logger = new Logger(this.constructor.name);
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(DashboardVariable, 'default')
    // readonly repo: Repository<DashboardVariable>,
    readonly repo: DashboardVariableRepository,
    readonly moduleRef: ModuleRef,
  ) {
    super(entityManager, repo, 'dashboardVariable', 'solid-core', moduleRef);
  }


}
