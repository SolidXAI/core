import { CommonEntity } from 'src/entities/common.entity';
import { Entity, JoinColumn, ManyToOne, Column, Index, OneToMany } from 'typeorm';
import { AgentRegistry } from './agent-registry.entity';
import { AgentSession } from './agent-session.entity'

@Entity('ss_agent_process')
export class AgentProcess extends CommonEntity {
    @ManyToOne(() => AgentRegistry, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    agent: AgentRegistry;

    @Column({ type: "varchar" })
    host: string;

    @Column({ type: "integer" })
    port: number;

    @Column({ type: "integer", nullable: true })
    pid: number;

    @Column({ type: "varchar" })
    ws_url: string = "";

    @Column({ type: "varchar", default: "starting" })
    status: string = "starting";

    @Column({ type: "integer" })
    config_version: number = 0;

    @Column({ type: "integer" })
    open_sessions: number = 0;

    @Column({ type: "integer" })
    running_turns: number = 0;

    @Column({ type: "integer" })
    max_sessions: number = 50;

    @Column({ type: "integer" })
    max_running_turns: number = 8;

    @Column({ type: "text", default: "{}" })
    load_report: string = "{}";

    @Column({ type: "timestamptz", default: () => "now()" })
    started_at: Date = new Date();

    @Column({ type: "timestamptz", nullable: true })
    heartbeat_at: Date;

    @Column({ type: "timestamptz", nullable: true })
    stopped_at: Date;

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    processId: string;

    @OneToMany(() => AgentSession, agentSession => agentSession.process, { cascade: true })
    agentSessions: AgentSession[];
}
