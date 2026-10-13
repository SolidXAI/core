import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentSessionCheckpoint } from '../entities/agent-session-checkpoint.entity';
import { AgentSessionCheckpointRepository } from '../repository/agent-session-checkpoint.repository';

@Injectable()
export class AgentSessionCheckpointService extends CRUDService<AgentSessionCheckpoint>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentSessionCheckpointRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentSessionCheckpoint', 'agent-hub', moduleRef);
 }
}