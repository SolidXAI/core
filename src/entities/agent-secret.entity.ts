import { CommonEntity } from 'src/entities/common.entity';
import { Secret } from 'src/entities/secret.entity';
import { Entity, JoinColumn, ManyToOne, Column, Index } from 'typeorm';
import { AgentRegistry } from './agent-registry.entity'

@Entity('ss_agent_secret')
export class AgentSecret extends CommonEntity {
    @ManyToOne(() => AgentRegistry, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    agentRegistry: AgentRegistry;

    @ManyToOne(() => Secret, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    secret: Secret;

    @Column({ type: "varchar", nullable: true })
    envVarName: string;

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    agentSecretKey: string;
}
