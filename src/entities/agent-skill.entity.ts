import { CommonEntity } from 'src/entities/common.entity';
import { Entity, JoinColumn, ManyToOne, Column, Index } from 'typeorm';
import { AgentRegistry } from './agent-registry.entity';
import { AgentSkillRegistry } from './agent-skill-registry.entity'

@Entity('ss_agent_skill')
export class AgentSkill extends CommonEntity {
    @ManyToOne(() => AgentRegistry, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    agentRegistry: AgentRegistry;

    @ManyToOne(() => AgentSkillRegistry, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    agentSkillRegistry: AgentSkillRegistry;

    @Column({ type: "boolean", default: true })
    alwaysInclude: boolean = true;

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    agentSkillKey: string;
}
