import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from '@solidxai/core';
import { AgenthubSessionCheckpoint } from '../entities/agenthub-session-checkpoint.entity';
import { AgenthubSessionCheckpointRepository } from '../repositories/agenthub-session-checkpoint.repository';

@Injectable()
export class AgenthubSessionCheckpointService extends CRUDService<AgenthubSessionCheckpoint>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgenthubSessionCheckpointRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agenthubSessionCheckpoint', 'agent-hub', moduleRef);
 }
}