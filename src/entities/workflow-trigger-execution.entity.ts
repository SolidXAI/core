import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { WorkflowDefinition } from './workflow-definition.entity';
import { WorkflowExecution } from './workflow-execution.entity'

@Entity('ss_workflow_trigger_execution')
export class WorkflowTriggerExecution extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    triggerExecutionKey: string;

    @Index()
    @ManyToOne(() => WorkflowDefinition, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    workflowDefinition: WorkflowDefinition;

    @Index()
    @ManyToOne(() => WorkflowExecution, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    workflowExecution: WorkflowExecution;

    @Index()
    @Column({ type: "varchar" })
    triggerId: string;

    @Column({ type: "varchar", nullable: true })
    triggerName: string;

    @Index()
    @Column({ type: "varchar" })
    triggerType: string;

    @Index()
    @Column({ type: "varchar", default: "received" })
    status: string = "received";

    @Index()
    @Column({ nullable: true, default: false })
    matched: boolean = false;

    @Index()
    @Column({ type: "timestamp" })
    firedAt: Date;

    @Index()
    @Column({ type: "timestamp", nullable: true })
    startedAt: Date;

    @Index()
    @Column({ type: "timestamp", nullable: true })
    finishedAt: Date;

    @Column({ type: "bigint", nullable: true })
    durationMs: bigint;

    @Index()
    @Column({ type: "varchar", nullable: true })
    source: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    correlationId: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    idempotencyKey: string;

    @Column({ type: "simple-json", nullable: true })
    payload: any;

    @Column({ type: "simple-json", nullable: true })
    triggerSnapshot: any;

    @Column({ type: "text", nullable: true })
    errorSummary: string;

    @Column({ type: "simple-json", nullable: true })
    errorDetails: any;

    @Column({ type: "simple-json", nullable: true })
    metadata: any;
}
