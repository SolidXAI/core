import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from '@solidxai/core';
import { AgentHumanRequest } from '../entities/agent-human-request.entity';
import { AgentHumanRequestRepository } from '../repositories/agent-human-request.repository';

@Injectable()
export class AgentHumanRequestService extends CRUDService<AgentHumanRequest>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentHumanRequestRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentHumanRequest', 'agent-hub', moduleRef);
 }
}