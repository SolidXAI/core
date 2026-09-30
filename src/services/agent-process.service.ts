import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from '@solidxai/core';
import { AgentProcess } from '../entities/agent-process.entity';
import { AgentProcessRepository } from '../repositories/agent-process.repository';

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