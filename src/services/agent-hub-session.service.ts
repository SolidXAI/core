import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from '@solidxai/core';
import { AgentHubSession } from '../entities/agent-hub-session.entity';
import { AgentHubSessionRepository } from '../repositories/agent-hub-session.repository';

@Injectable()
export class AgentHubSessionService extends CRUDService<AgentHubSession>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentHubSessionRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentHubSession', 'agent-hub', moduleRef);
 }
}