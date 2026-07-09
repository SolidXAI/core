import { CommonEntity } from 'src/entities/common.entity';
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('ss_workflow_definition')
export class WorkflowDefinition extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    key: string;

    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: "RESTRICT", nullable: false })
    @JoinColumn()
    moduleMetadata: ModuleMetadata;

    @Index()
    @Column({ type: "varchar" })
    displayName: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    namespace: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Index()
    @Column({ type: "varchar", default: "draft" })
    status: string = "draft";

    @Column({ type: "varchar", nullable: true })
    definitionVersion: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    definitionChecksum: string;

    @Column({ type: "simple-json" })
    definitionJson: any;

    @Column({ type: "simple-json", nullable: true })
    tags: any;
}
