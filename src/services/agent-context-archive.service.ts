import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentContextArchive } from '../entities/agent-context-archive.entity';
import { AgentContextArchiveRepository } from '../repository/agent-context-archive.repository';

@Injectable()
export class AgentContextArchiveService extends CRUDService<AgentContextArchive>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentContextArchiveRepository,
    readonly moduleRef: ModuleRef,

 ) {
   super(entityManager, repo, 'agentContextArchive', 'agent-hub', moduleRef);
 }
}
