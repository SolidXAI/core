import { CommonEntity } from 'src/entities/common.entity';
import { User } from 'src/entities/user.entity';
import { Entity, Column, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AgentRegistry } from './agent-registry.entity';
import { AgentProcess } from './agent-process.entity';
import { AgentJob } from './agent-job.entity';
import { AgentEvent } from './agent-event.entity';
import { AgenthubSessionCheckpoint } from './agenthub-session-checkpoint.entity';
import { AgentHumanRequest } from './agent-human-request.entity';

@Entity('ss_agent_session')
export class AgentSession extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    sessionId: string;

    @ManyToOne(() => AgentRegistry, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    agent: AgentRegistry;

    @ManyToOne(() => AgentProcess, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    process: AgentProcess;

    @Column({ type: "varchar" })
    trigger: string;

    @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: false })
    @JoinColumn()
    user: User;

    @Column({ type: "varchar", default: "queued" })
    status: string = "queued";

    @Column({ type: "text", default: "{}" })
    inputs: string = "{}";

    @Column({ type: "integer" })
    configVersion: number;

    @Column({ type: "integer", default: 0 })
    turnCount: number = 0;

    @Column({ type: "integer", default: 0 })
    totalSteps: number = 0;

    @Column({ type: "integer", default: 0 })
    totalInputTokens: number = 0;

    @Column({ type: "integer", default: 0 })
    totalOutputTokens: number = 0;

    @Column({ type: "decimal" })
    totalCost: number = 0;

    @Column({ type: "text", nullable: true })
    error: string;

    @Column({ type: "timestamptz", default: () => "now()" })
    startedAt: Date = new Date();

    @Column({ type: "timestamptz", default: () => "now()" })
    lastActiveAt: Date = new Date();

    @Column({ type: "timestamptz", nullable: true })
    endedAt: Date;

    @Column({ type: "varchar", nullable: true })
    reasoningModelKey: string;

    @Column({ type: "varchar", nullable: true })
    fastModelKey: string;

    @OneToMany(() => AgentJob, agentJob => agentJob.session, { cascade: true })
    agentJobs: AgentJob[];

    @OneToMany(() => AgentEvent, agentEvent => agentEvent.session, { cascade: true })
    agentEvents: AgentEvent[];

    @OneToMany(() => AgenthubSessionCheckpoint, agenthubSessionCheckpoint => agenthubSessionCheckpoint.session, { cascade: true })
    agenthubSessionCheckpoints: AgenthubSessionCheckpoint[];

    @OneToMany(() => AgentHumanRequest, agentHumanRequest => agentHumanRequest.session, { cascade: true })
    agentHumanRequests: AgentHumanRequest[];
}
