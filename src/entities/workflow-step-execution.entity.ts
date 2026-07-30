import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { WorkflowExecution } from './workflow-execution.entity'

@Entity('ss_workflow_step_execution')
export class WorkflowStepExecution extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    stepExecutionKey: string;

    @Index()
    @ManyToOne(() => WorkflowExecution, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    workflowExecution: WorkflowExecution;

    @Index()
    @Column({ type: "varchar" })
    nodeId: string;

    @Column({ type: "varchar", nullable: true })
    nodeName: string;

    @Index()
    @Column({ type: "varchar", default: "task" })
    nodeKind: string = "task";

    @Index()
    @Column({ type: "varchar" })
    nodeType: string;

    @Index()
    @Column({ type: "varchar", default: "created" })
    status: string = "created";

    @Index()
    @Column({ type: "integer", default: 1 })
    attemptNumber: number = 1;

    @Column({ type: "integer", nullable: true, default: 0 })
    retryCount: number = 0;

    @Column({ type: "integer", nullable: true })
    maxRetries: number;

    @Index()
    @Column({ type: "varchar", nullable: true })
    parentNodeId: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    parentStepExecutionKey: string;

    @Index()
    @Column({ type: "integer", nullable: true })
    sequenceNumber: number;

    @Index()
    @Column({ nullable: true })
    startedAt: Date;

    @Index()
    @Column({ nullable: true })
    finishedAt: Date;

    @Column({ type: "bigint", nullable: true })
    durationMs: bigint;

    @Column({ type: "bigint", nullable: true })
    timeoutMs: bigint;

    @Column({ type: "simple-json", nullable: true })
    inputPayload: any;

    @Column({ type: "simple-json", nullable: true })
    outputPayload: any;

    @Column({ type: "simple-json", nullable: true })
    runtimeContext: any;

    @Column({ type: "simple-json", nullable: true })
    nodeSnapshot: any;

    @Column({ type: "text", nullable: true })
    errorSummary: string;

    @Column({ type: "simple-json", nullable: true })
    errorDetails: any;
}
