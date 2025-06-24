import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from 'src/services/file.service';
import { CrudHelperService } from 'src/services/crud-helper.service';


import { UserActivityHistory } from '../entities/user-activity-history.entity';
import { RequestContextService } from './request-context.service';
import { User } from 'src/entities/user.entity';

@Injectable()
export class UserActivityHistoryService extends CRUDService<UserActivityHistory> {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(UserActivityHistory, 'default')
    readonly repo: Repository<UserActivityHistory>,
    readonly moduleRef: ModuleRef,
    readonly requestContextService: RequestContextService,

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'userActivityHistory', 'solid-core', moduleRef);
  }
  async logEvent(event: 'login' | 'logout' | 'tokenRefreshed', user: User) {
    const ip = this.requestContextService.getIp();
    const userAgent = this.requestContextService.getUserAgent();

    await this.repo.save({
      user,
      event,
      ipAddress: ip,
      userAgent,
    });
  }

}
