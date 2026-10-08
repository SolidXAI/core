import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentHumanRequest } from '../entities/agent-human-request.entity';
import { AgentHumanRequestRepository } from '../repository/agent-human-request.repository';

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