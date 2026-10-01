import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, OneToMany } from 'typeorm';
import { AgentSkill } from './agent-skill.entity'

@Entity('ss_agent_skill_registry')
export class AgentSkillRegistry extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    name: string;

    @Column({ type: "varchar", nullable: true })
    iconName?: string;

    @Column({ type: "text" })
    description: string;

    @Column({ type: "text" })
    body: string;

    @Column({ type: "text", default: "{}" })
    tags: string = "{}";

    @OneToMany(() => AgentSkill, agentSkill => agentSkill.agentSkillRegistry, { cascade: true })
    agentSkills: AgentSkill[];
}
