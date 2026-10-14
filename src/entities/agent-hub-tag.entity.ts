import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, JoinColumn, ManyToMany, ManyToOne } from 'typeorm';
import { ModuleMetadata } from './module-metadata.entity';
import { AgentSkillRegistry } from './agent-skill-registry.entity';
import { AgentToolRegistry } from './agent-tool-registry.entity';
import { AgentRegistry } from './agent-registry.entity';

@Entity('ss_agent_hub_tag')
export class AgentHubTag extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: 'varchar' })
    name: string;

    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'module_id', referencedColumnName: 'id' })
    module: ModuleMetadata;

    @ManyToMany(() => AgentSkillRegistry, skill => skill.tags)
    skills: AgentSkillRegistry[];

    @ManyToMany(() => AgentToolRegistry, tool => tool.tags)
    tools: AgentToolRegistry[];

    @ManyToMany(() => AgentRegistry, agent => agent.tags)
    agents: AgentRegistry[];
}
