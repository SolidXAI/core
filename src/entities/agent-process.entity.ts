import { CommonEntity } from 'src/entities/common.entity';
import { Exclude } from 'class-transformer';
import { Entity, JoinColumn, ManyToOne, Column, Index, OneToMany } from 'typeorm';
import { AgentRegistry } from './agent-registry.entity';
import { AgentSession } from './agent-session.entity'
import { getColumnType, getCurrentTimestampDefault } from 'src/helpers/typeorm-db-helper';

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

    @Column({ type: "varchar", nullable: true })
    runner: string | null;

    @Column({ type: "varchar", length: 512, nullable: true })
    runnerRef: string | null;

    @Exclude({ toPlainOnly: true })
    @Column({ type: "varchar", default: "", select: false, insert: false, update: false })
    internalUrl: string = "";

    @Exclude({ toPlainOnly: true })
    @Column({ type: "varchar", length: 64, nullable: true, select: false, insert: false, update: false })
    bootstrapTokenHash: string | null;

    @Exclude({ toPlainOnly: true })
    @Column({ ...getColumnType('datetimeWithTimezone'), nullable: true, select: false, insert: false, update: false })
    bootstrapExpiresAt: Date | null;

    @Column({ type: "varchar", nullable: true })
    runtimeVersion: string | null;

    @Column({ type: "integer", nullable: true })
    cpu: number | null;

    @Column({ type: "integer", nullable: true })
    memory: number | null;

    @Column({ type: "varchar" })
    wsUrl: string = "";

    @Column({ type: "varchar", default: "starting" })
    status: string = "starting";

    @Column({ type: "integer" })
    configVersion: number = 0;

    @Column({ type: "integer" })
    openSessions: number = 0;

    @Column({ type: "integer" })
    runningTurns: number = 0;

    @Column({ type: "integer" })
    maxSessions: number = 50;

    @Column({ type: "integer" })
    maxRunningTurns: number = 8;

    @Column({ type: "text", default: "{}" })
    loadReport: string = "{}";

    @Column({ ...getColumnType('datetimeWithTimezone'), default: () => getCurrentTimestampDefault() })
    startedAt: Date = new Date();

    @Column({ ...getColumnType('datetimeWithTimezone'), nullable: true })
    heartbeatAt: Date;

    @Column({ ...getColumnType('datetimeWithTimezone'), nullable: true })
    stoppedAt: Date;

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    processId: string;

    @OneToMany(() => AgentSession, agentSession => agentSession.process, { cascade: true })
    agentSessions: AgentSession[];
}
