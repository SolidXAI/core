import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { AgentConfigLinkService } from './agent-config-version.service';
import { AgentTool } from '../entities/agent-tool.entity';
import { AgentToolRepository } from '../repository/agent-tool.repository';

@Injectable()
export class AgentToolService extends AgentConfigLinkService<AgentTool>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentToolRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentTool', moduleRef, AgentTool);
 }
}
