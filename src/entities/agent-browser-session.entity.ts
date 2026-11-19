import { Exclude } from 'class-transformer';
import { CommonEntity } from 'src/entities/common.entity';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { getColumnType } from 'src/helpers/typeorm-db-helper';
import { AgentSession } from './agent-session.entity';

/**
 * The browser behind one AgentHub session: its pool lease, Steel session and event cursors. Written
 * only by the AgentHub runtime (browser tools); at most one row per session is not "released".
 */
@Entity('ss_agent_browser_session')
@Index('ux_ss_agent_browser_session_live', ['session'], { unique: true, where: "status <> 'released'" })
@Check('ss_agent_browser_session_control_mode_check', "control_mode IN ('agent', 'human')")
@Check('ss_agent_browser_session_status_check', "status IN ('active', 'state_saved', 'released')")
export class AgentBrowserSession extends CommonEntity {
    @Index('ix_ss_agent_browser_session_session_id')
    @ManyToOne(() => AgentSession, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    session: AgentSession;

    @Column({ type: "varchar", nullable: true })
    leaseId: string | null;

    @Column({ type: "varchar", nullable: true })
    containerName: string | null;

    @Column({ type: "varchar", nullable: true })
    steelSessionId: string | null;

    @Column({ type: "varchar", nullable: true })
    afterCursor: string | null;

    @Column({ type: "varchar", nullable: true })
    eventsCursor: string | null;

    @Column({ type: "integer", default: 0 })
    epoch: number = 0;

    @Column({ type: "varchar", nullable: true })
    activeTab: string | null;

    @Column({ type: "text", nullable: true })
    currentUrl: string | null;

    @Column({ type: "varchar", default: "agent" })
    controlMode: string = "agent";

    @Column({ type: "varchar", default: "active" })
    status: string = "active";

    // The browser's saved sign-ins and storage, encrypted by the runtime: never sent to API clients.
    @Exclude()
    @Column({ type: "text", nullable: true })
    contextEncrypted: string | null;

    @Column({ ...getColumnType('datetimeWithTimezone'), nullable: true })
    handoffExpiresAt: Date | null;
}
