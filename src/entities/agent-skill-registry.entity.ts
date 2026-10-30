import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
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

    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: "RESTRICT", nullable: false })
    @JoinColumn({ name: 'module_id', referencedColumnName: 'id' })
    module: ModuleMetadata;

    @ManyToMany(() => AgentHubTag, tag => tag.skills, { cascade: ['insert', 'update'] })
    @JoinTable()
    tags: AgentHubTag[];

    @OneToMany(() => AgentSkill, agentSkill => agentSkill.agentSkillRegistry, { cascade: true })
    agentSkills: AgentSkill[];
}
