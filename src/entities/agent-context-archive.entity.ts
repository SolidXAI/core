import { CommonEntity } from 'src/entities/common.entity';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AgentSession } from './agent-session.entity';

/**
 * Full, redacted originals of context that AgentHub auto-compaction removed from a session's model
 * input. Written once by the AgentHub runtime and read back by its context_recall tool, always for
 * the session that wrote them.
 */
@Entity('ss_agent_context_archive')
@Unique('ux_ss_agent_context_archive_session_ref', ['session', 'ref'])
@Check('ss_agent_context_archive_kind_check', "kind IN ('tool_result', 'transcript')")
export class AgentContextArchive extends CommonEntity {
    @Index('ix_ss_agent_context_archive_session_id')
    @ManyToOne(() => AgentSession, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    session: AgentSession;

    @Column({ type: "varchar" })
    ref: string;

    @Column({ type: "varchar" })
    kind: string;

    @Column({ type: "varchar", nullable: true })
    toolCallId: string | null;

    @Column({ type: "varchar", nullable: true })
    toolName: string | null;

    @Column({ type: "integer", default: 0 })
    turnNumber: number = 0;

    @Column({ type: "integer", nullable: true })
    stepNumber: number | null;

    @Column({ type: "varchar", nullable: true })
    compactionId: string | null;

    @Column({ type: "text" })
    content: string;

    @Column({ type: "integer", default: 0 })
    contentChars: number = 0;

    @Column({ type: "integer", default: 0 })
    tokenEstimate: number = 0;
}
