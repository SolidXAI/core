import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentBrowserSession } from '../entities/agent-browser-session.entity';
import { AgentBrowserSessionRepository } from '../repository/agent-browser-session.repository';

@Injectable()
export class AgentBrowserSessionService extends CRUDService<AgentBrowserSession>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentBrowserSessionRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentBrowserSession', 'agent-hub', moduleRef);
 }
}
