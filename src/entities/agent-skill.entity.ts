import { CommonEntity } from 'src/entities/common.entity';
import { Entity, JoinColumn, ManyToOne, Column, Index, RelationId } from 'typeorm';
import { AgentRegistry } from './agent-registry.entity';
import { AgentSkillRegistry } from './agent-skill-registry.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity('ss_agent_skill')
export class AgentSkill extends CommonEntity {
    @ManyToOne(() => AgentRegistry, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    agentRegistry: AgentRegistry;

    @RelationId((agentSkill: AgentSkill) => agentSkill.agentRegistry)
    agentRegistryId: number;

    @ManyToOne(() => AgentSkillRegistry, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    agentSkillRegistry: AgentSkillRegistry;

    @Column({ ...getColumnType('boolean'), default: true })
    alwaysInclude: boolean = true;

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    agentSkillKey: string;
}
