import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { DashboardUserLayout } from '../entities/dashboard-user-layout.entity';
import { DashboardUserLayoutRepository } from '../repositories/dashboard-user-layout.repository';

@Injectable()
export class DashboardUserLayoutService extends CRUDService<DashboardUserLayout>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: DashboardUserLayoutRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'dashboardUserLayout', 'solid-core', moduleRef);
 }
}