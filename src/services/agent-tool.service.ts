import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from '@solidxai/core';
import { AgentTool } from '../entities/agent-tool.entity';
import { AgentToolRepository } from '../repositories/agent-tool.repository';

@Injectable()
export class AgentToolService extends CRUDService<AgentTool>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentToolRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentTool', 'agent-hub', moduleRef);
 }
}