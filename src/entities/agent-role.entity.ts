import { CommonEntity } from 'src/entities/common.entity';
import { RoleMetadata } from 'src/entities/role-metadata.entity';
import { Entity, JoinColumn, ManyToOne, Column, Index } from 'typeorm';
import { AgentRegistry } from './agent-registry.entity'

@Entity('ss_agent_role')
export class AgentRole extends CommonEntity {
    @ManyToOne(() => AgentRegistry, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    agentRegistry: AgentRegistry;

    @ManyToOne(() => RoleMetadata, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    roleMetadata: RoleMetadata;

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    agentRoleKey: string;
}
