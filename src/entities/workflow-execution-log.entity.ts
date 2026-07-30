import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { WorkflowExecution } from './workflow-execution.entity';
import { WorkflowStepExecution } from './workflow-step-execution.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity('ss_workflow_execution_log')
export class WorkflowExecutionLog extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    logKey: string;

    @Index()
    @ManyToOne(() => WorkflowExecution, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    workflowExecution: WorkflowExecution;

    @Index()
    @ManyToOne(() => WorkflowStepExecution, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    workflowStepExecution: WorkflowStepExecution;

    @Index()
    @Column({ type: "varchar", default: "info" })
    level: string = "info";

    @Column({ type: "text" })
    message: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    eventType: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    source: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    nodeId: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    nodeType: string;

    @Index()
    @Column({ type: "integer", nullable: true })
    sequenceNumber: number;

    @Index()
    @Column({ ...getColumnType('datetime') })
    occurredAt: Date;

    @Column({ type: "simple-json", nullable: true })
    context: any;

    @Column({ type: "simple-json", nullable: true })
    metadata: any;
}
