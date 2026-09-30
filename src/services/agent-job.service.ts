import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from '@solidxai/core';
import { AgentJob } from '../entities/agent-job.entity';
import { AgentJobRepository } from '../repositories/agent-job.repository';

@Injectable()
export class AgentJobService extends CRUDService<AgentJob>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentJobRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentJob', 'agent-hub', moduleRef);
 }
}