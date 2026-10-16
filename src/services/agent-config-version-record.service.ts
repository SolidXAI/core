import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from '@nestjs/core';
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentConfigVersion } from '../entities/agent-config-version.entity';
import { AgentConfigVersionRepository } from '../repository/agent-config-version.repository';

@Injectable()
export class AgentConfigVersionRecordService extends CRUDService<AgentConfigVersion> {
    constructor(
        @InjectEntityManager('default')
        readonly entityManager: EntityManager,
        readonly repo: AgentConfigVersionRepository,
        readonly moduleRef: ModuleRef,
    ) {
        super(entityManager, repo, 'agentConfigVersion', 'agent-hub', moduleRef);
    }
}
