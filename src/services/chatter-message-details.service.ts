import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from "@nestjs/core";
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';

import { ChatterMessageDetails } from '../entities/chatter-message-details.entity';
import { ChatterMessageDetailsRepository } from 'src/repository/chatter-message-details.repository';

@Injectable()
export class ChatterMessageDetailsService extends CRUDService<ChatterMessageDetails>{
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(ChatterMessageDetails, 'default')
    readonly repo: ChatterMessageDetailsRepository,
    readonly moduleRef: ModuleRef,
  ) {
    super(entityManager, repo, 'chatterMessageDetails', 'solid-core', moduleRef);
  }
}
