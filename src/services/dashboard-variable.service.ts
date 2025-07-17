import { Injectable, Logger } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { CRUDService } from 'src/services/crud.service';
import { FileService } from 'src/services/file.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';


import { DashboardVariable } from '../entities/dashboard-variable.entity';

@Injectable()
export class DashboardVariableService extends CRUDService<DashboardVariable> {
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
    @InjectRepository(DashboardVariable, 'default')
    readonly repo: Repository<DashboardVariable>,
    readonly moduleRef: ModuleRef,
  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'dashboardVariable', 'solid-core', moduleRef);
  }


}
