import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AgentHubTag } from '../entities/agent-hub-tag.entity';
import { AgentHubTagRepository } from '../repository/agent-hub-tag.repository';
import { CRUDService } from './crud.service';

@Injectable()
export class AgentHubTagService extends CRUDService<AgentHubTag> {
    constructor(
        @InjectEntityManager('default')
        readonly entityManager: EntityManager,
        readonly repo: AgentHubTagRepository,
        readonly moduleRef: ModuleRef,
    ) {
        super(entityManager, repo, 'agentHubTag', 'agent-hub', moduleRef);
    }
}
