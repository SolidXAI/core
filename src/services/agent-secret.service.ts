import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentSecret } from '../entities/agent-secret.entity';
import { AgentSecretRepository } from '../repository/agent-secret.repository';

@Injectable()
export class AgentSecretService extends CRUDService<AgentSecret>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentSecretRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentSecret', 'agent-hub', moduleRef);
 }
}