import { CommonEntity } from 'src/entities/common.entity';
import { Entity, JoinColumn, ManyToOne, Column } from 'typeorm';
import { AgentHubSession } from './agent-hub-session.entity'

@Entity('ss_agenthub_session_checkpoint')
export class AgenthubSessionCheckpoint extends CommonEntity {
    @ManyToOne(() => AgentHubSession, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    session: AgentHubSession;

    @Column({ type: "integer" })
    seq: number;

    @Column({ type: "integer" })
    turn_number: number;

    @Column({ type: "text" })
    messages: string;

    @Column({ type: "text", nullable: true })
    pending: string;

    @Column({ type: "integer", default: 0 })
    n_calls: number = 0;

    @Column({ type: "double precision" })
    cost: number;
}
