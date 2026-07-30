import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index } from 'typeorm';

@Entity('ss_workflow_secret')
export class WorkflowSecret extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    key: string;

    @Index()
    @Column({ type: "varchar" })
    displayName: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Column({ type: "text" })
    value: string;

    @Index()
    @Column({ type: "varchar", default: "string" })
    valueType: string = "string";

    @Index()
    @Column({ type: "varchar", default: "active" })
    status: string = "active";

    @Column({ nullable: true })
    lastRotatedAt: Date;

    @Column({ nullable: true })
    lastAccessedAt: Date;
}
