import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource, DeepPartial } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { AgentRegistry } from '../entities/agent-registry.entity';

@Injectable()
export class AgentRegistryRepository extends SolidBaseRepository<AgentRegistry> {
    constructor(
        @InjectDataSource("default")
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(AgentRegistry, dataSource, requestContextService, securityRuleRepository);
    }

    override merge(entity: AgentRegistry, ...changes: DeepPartial<AgentRegistry>[]): AgentRegistry {
        const merged = super.merge(entity, ...changes);
        // CRUDService saves this entity after merging. Keep its potentially stale version
        // out of that save; version changes use an atomic update query instead.
        delete merged.configVersion;
        return merged;
    }
}
