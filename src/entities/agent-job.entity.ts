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
    callerSnapshot: string;

    @Column({ type: "varchar", default: "queued" })
    status: string = "queued";

    @Column({ type: "varchar", nullable: true })
    leaseToken: string;

    @Column({ type: "timestamptz", nullable: true })
    leaseExpiresAt: Date;

    @Column({ type: "integer", default: 0 })
    attempts: number = 0;

    @Column({ type: "text", nullable: true })
    idempotencyKey: string;

    @Column({ type: "text", nullable: true })
    webhookUrl: string;

    @Column({ type: "text", nullable: true })
    webhookSecret: string;

    @Column({ type: "integer", nullable: true })
    timeoutSeconds: number;

    @Column({ type: "integer", nullable: true })
    maxSteps: number;

    @Column({ type: "text", nullable: true })
    result: string;

    @Column({ type: "text", nullable: true })
    error: string;

    @Column({ type: "timestamptz", default: () => "now()" })
    queuedAt: Date = new Date();

    @Column({ type: "timestamptz", nullable: true })
    startedAt: Date;

    @Column({ type: "timestamptz", nullable: true })
    finishedAt: Date;

    @OneToMany(() => AgentHumanRequest, agentHumanRequest => agentHumanRequest.job, { cascade: true })
    agentHumanRequests: AgentHumanRequest[];
}
