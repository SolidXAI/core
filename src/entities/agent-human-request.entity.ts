import { CommonEntity } from 'src/entities/common.entity';
import { Entity, JoinColumn, ManyToOne, Column } from 'typeorm';
import { AgentSession } from './agent-session.entity';
import { AgentJob } from './agent-job.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity('ss_agent_human_request')
export class AgentHumanRequest extends CommonEntity {
    @ManyToOne(() => AgentSession, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    session: AgentSession;

    @ManyToOne(() => AgentJob, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    job: AgentJob;

    @Column({ type: "varchar" })
    kind: string;

    @Column({ type: "text" })
    question: string;

    @Column({ type: "text", nullable: true })
    options: string;

    @Column({ type: "text", nullable: true })
    context: string;

    @Column({ type: "text" })
    toolCallId: string;

    @Column({ type: "text" })
    toolName: string;

    @Column({ type: "text" })
    toolArguments: string;

    @Column({ type: "varchar", default: "pending" })
    status: string = "pending";

    @Column({ type: "text", nullable: true })
    answer: string;

    @Column({ type: "varchar", nullable: true })
    answeredBy: string;

    @Column({ ...getColumnType('datetimeWithTimezone'), nullable: true })
    answeredAt: Date;
}
