import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index } from 'typeorm';
import { getColumnType } from 'src/helpers/typeorm-db-helper';

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

    @Column({ nullable: true, ...getColumnType('datetime') })
    lastRotatedAt: Date;

    @Column({ nullable: true, ...getColumnType('datetime') })
    lastAccessedAt: Date;
}
