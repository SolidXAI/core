import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from "@nestjs/core";
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';


import { UserActivityHistory } from '../entities/user-activity-history.entity';
import { RequestContextService } from './request-context.service';
import { User } from 'src/entities/user.entity';
import { UserActivityHistoryRepository } from 'src/repository/user-activity-history.repository';

@Injectable()
export class UserActivityHistoryService extends CRUDService<UserActivityHistory> {
  private readonly _logger = new Logger(UserActivityHistoryService.name);

  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(UserActivityHistory, 'default')
    // readonly repo: Repository<UserActivityHistory>,
    readonly repo: UserActivityHistoryRepository,
    readonly moduleRef: ModuleRef,
    readonly requestContextService: RequestContextService,

  ) {
    super(entityManager, repo, 'userActivityHistory', 'solid-core', moduleRef);
  }
  async logEvent(event: 'login' | 'logout' | 'tokenRefreshed', user: User) {
    try {
      const ip = this.requestContextService.getIp();
      const userAgent = this.requestContextService.getUserAgent();

      await this.repo.save({
        user,
        event,
        ipAddress: ip,
        userAgent,
      });
    } catch (err) {
      this._logger.warn(`Failed to log event "${event}" for user ${user?.id}: ${err}`);
    }
  }

}
