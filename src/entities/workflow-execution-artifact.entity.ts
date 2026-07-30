import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { WorkflowExecution } from './workflow-execution.entity';
import { WorkflowStepExecution } from './workflow-step-execution.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity('ss_workflow_execution_artifact')
export class WorkflowExecutionArtifact extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    artifactKey: string;

    @Index()
    @ManyToOne(() => WorkflowExecution, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    workflowExecution: WorkflowExecution;

    @Index()
    @ManyToOne(() => WorkflowStepExecution, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    workflowStepExecution: WorkflowStepExecution;

    @Index()
    @Column({ type: "varchar" })
    name: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Index()
    @Column({ type: "varchar", default: "payload" })
    artifactType: string = "payload";

    @Index()
    @Column({ type: "varchar", nullable: true })
    nodeId: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    nodeType: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    storageProviderKey: string;

    @Column({ type: "text", nullable: true })
    uri: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    fileName: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    mimeType: string;

    @Column({ type: "bigint", nullable: true })
    sizeBytes: bigint;

    @Index()
    @Column({ type: "varchar", nullable: true })
    checksum: string;

    @Index()
    @Column({ nullable: true, ...getColumnType('datetime') })
    producedAt: Date;

    @Column({ type: "simple-json", nullable: true })
    payload: any;

    @Column({ type: "simple-json", nullable: true })
    metadata: any;
}
