import { CommonEntity } from 'src/entities/common.entity';
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
