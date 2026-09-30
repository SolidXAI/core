import { CommonEntity } from 'src/entities/common.entity';
import { Entity, JoinColumn, ManyToOne, Column, OneToMany } from 'typeorm';
import { AgentSession } from './agent-session.entity';
import { AgentRegistry } from './agent-registry.entity';
import { AgentHumanRequest } from './agent-human-request.entity';

@Entity('ss_agent_job')
export class AgentJob extends CommonEntity {
    @ManyToOne(() => AgentSession, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    session: AgentSession;

    @ManyToOne(() => AgentRegistry, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    agent: AgentRegistry;

    @Column({ type: "varchar", default: "start" })
    kind: string = "start";

    @Column({ type: "text", nullable: true })
    input: string;

    @Column({ type: "text" })
    caller_snapshot: string;

    @Column({ type: "varchar", default: "queued" })
    status: string = "queued";

    @Column({ type: "varchar", nullable: true })
    lease_token: string;

    @Column({ type: "timestamptz", nullable: true })
    lease_expires_at: Date;

    @Column({ type: "integer", default: 0 })
    attempts: number = 0;

    @Column({ type: "text", nullable: true })
    idempotency_key: string;

    @Column({ type: "text", nullable: true })
    webhook_url: string;

    @Column({ type: "text", nullable: true })
    webhook_secret: string;

    @Column({ type: "integer", nullable: true })
    timeout_seconds: number;

    @Column({ type: "integer", nullable: true })
    max_steps: number;

    @Column({ type: "text", nullable: true })
    result: string;

    @Column({ type: "text", nullable: true })
    error: string;

    @Column({ type: "timestamptz", default: () => "now()" })
    queued_at: Date = new Date();

    @Column({ type: "timestamptz", nullable: true })
    started_at: Date;

    @Column({ type: "timestamptz", nullable: true })
    finished_at: Date;

    @OneToMany(() => AgentHumanRequest, agentHumanRequest => agentHumanRequest.job, { cascade: true })
    agentHumanRequests: AgentHumanRequest[];
}
