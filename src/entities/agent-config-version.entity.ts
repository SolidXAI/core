import { CommonEntity } from 'src/entities/common.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AgentRegistry } from './agent-registry.entity';

@Entity('ss_agent_config_version')
@Index(['agentRegistry', 'versionNumber'], { unique: true })
export class AgentConfigVersion extends CommonEntity {
    @Column({ type: 'integer' })
    versionNumber: number;

    @Column({ type: 'varchar', nullable: true })
    name: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @ManyToOne(() => AgentRegistry, agent => agent.configVersions, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'agent_registry_id', referencedColumnName: 'id' })
    agentRegistry: AgentRegistry;
}
