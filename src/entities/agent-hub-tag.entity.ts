import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, ManyToMany } from 'typeorm';
import { AgentSkillRegistry } from './agent-skill-registry.entity';
import { AgentToolRegistry } from './agent-tool-registry.entity';
import { AgentRegistry } from './agent-registry.entity';

@Entity('ss_agent_hub_tag')
export class AgentHubTag extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: 'varchar' })
    name: string;

    @ManyToMany(() => AgentSkillRegistry, skill => skill.tags)
    skills: AgentSkillRegistry[];

    @ManyToMany(() => AgentToolRegistry, tool => tool.tags)
    tools: AgentToolRegistry[];

    @ManyToMany(() => AgentRegistry, agent => agent.tags)
    agents: AgentRegistry[];
}
