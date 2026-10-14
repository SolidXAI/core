import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { AgentHubTag } from './agent-hub-tag.entity';
import { AgentSkill } from './agent-skill.entity'

@Entity('ss_agent_skill_registry')
export class AgentSkillRegistry extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    name: string;

    @Column({ type: "varchar", default: "custom" })
    type: string = "custom";

    @Column({ type: "varchar", nullable: true })
    iconName?: string;

    @Column({ type: "text" })
    description: string;

    @Column({ type: "text" })
    body: string;

    @ManyToMany(() => AgentHubTag, tag => tag.skills, { cascade: ['insert', 'update'] })
    @JoinTable()
    tags: AgentHubTag[];

    @OneToMany(() => AgentSkill, agentSkill => agentSkill.agentSkillRegistry, { cascade: true })
    agentSkills: AgentSkill[];
}
