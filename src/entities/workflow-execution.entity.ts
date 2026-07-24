import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { WorkflowDefinition } from './workflow-definition.entity'
import { WorkflowStepExecution } from './workflow-step-execution.entity';
import { WorkflowExecutionLog } from './workflow-execution-log.entity';
import { WorkflowExecutionArtifact } from './workflow-execution-artifact.entity';

@Entity('ss_workflow_execution')
export class WorkflowExecution extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    executionIdentifier: string;

    @Index()
    @ManyToOne(() => WorkflowDefinition, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    workflowDefinition: WorkflowDefinition;

    @Index()
    @Column({ type: "varchar" })
    workflowKey: string;

    @Column({ type: "varchar", nullable: true })
    workflowDisplayName: string;

    @Index()
    @Column({ type: "varchar", default: "created" })
    status: string = "created";

    @Index()
    @Column({ type: "varchar", default: "manual" })
    triggerType: string = "manual";

    @Index()
    @Column({ type: "timestamp", nullable: true })
    startedAt: Date;

    @Index()
    @Column({ type: "timestamp", nullable: true })
    finishedAt: Date;

    @Column({ type: "bigint", nullable: true })
    durationMs: bigint;

    @Column({ type: "simple-json", nullable: true })
    inputPayload: any;

    // Retained for schema/backward compatibility only. Combined workflow output
    // is no longer persisted here because large loops can make this payload
    // duplicate all step outputs and cause OOMs; use step execution outputs.
    @Column({ type: "simple-json", nullable: true })
    outputPayload: any;

    @Column({ type: "varchar", nullable: true })
    definitionVersion: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    definitionChecksum: string;

    @Column({ name: "definition_snapshot", type: "text", nullable: true})
    definitionSnapshot: string;

    @Column({ type: "text", nullable: true })
    errorSummary: string;

    @Column({ type: "simple-json", nullable: true })
    errorDetails: any;

    @Index()
    @Column({ type: "bigint", nullable: true })
    requestedByUserId: bigint;

    @OneToMany(() => WorkflowStepExecution, workflowStepExecution => workflowStepExecution.workflowExecution, { cascade: true })
    workflowStepExecutions: WorkflowStepExecution[];

    @OneToMany(() => WorkflowExecutionLog, workflowExecutionLog => workflowExecutionLog.workflowExecution, { cascade: true })
    workflowExecutionLogs: WorkflowExecutionLog[];

    @OneToMany(() => WorkflowExecutionArtifact, workflowExecutionArtifact => workflowExecutionArtifact.workflowExecution, { cascade: true })
    workflowExecutionArtifacts: WorkflowExecutionArtifact[];
}
