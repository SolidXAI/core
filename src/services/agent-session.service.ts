import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentSession } from '../entities/agent-session.entity';
import { AgentSessionRepository } from '../repository/agent-session.repository';

@Injectable()
export class AgentSessionService extends CRUDService<AgentSession>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentSessionRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentSession', 'agent-hub', moduleRef);
 }
}