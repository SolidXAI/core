import { CommonEntity } from 'src/entities/common.entity';
import { Entity, JoinColumn, ManyToOne, Column } from 'typeorm';
import { AgentSession } from './agent-session.entity'

@Entity('ss_agent_session_checkpoint')
export class AgentSessionCheckpoint extends CommonEntity {
    @ManyToOne(() => AgentSession, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    session: AgentSession;

    @Column({ type: "integer" })
    seq: number;

    @Column({ type: "integer" })
    turnNumber: number;

    @Column({ type: "text" })
    messages: string;

    @Column({ type: "text", nullable: true })
    pending: string;

    @Column({ type: "integer", default: 0 })
    nCalls: number = 0;

    @Column({ type: "double precision" })
    cost: number;
}
