import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentProcess } from '../entities/agent-process.entity';
import { AgentProcessRepository } from '../repository/agent-process.repository';

@Injectable()
export class AgentProcessService extends CRUDService<AgentProcess>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentProcessRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentProcess', 'agent-hub', moduleRef);
 }
}