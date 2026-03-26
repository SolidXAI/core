import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, Index, ManyToOne } from "typeorm";
import { MqMessageQueue } from 'src/entities/mq-message-queue.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';
@Entity("ss_mq_message")
export class MqMessage extends CommonEntity {
    @Column({ type: "varchar", nullable: true })
    messageId: string;

    @Column({ type: "varchar", nullable: true })
    messageBroker: string;

    @Column({ type: "integer", nullable: true })
    retryCount: number;

    @Column({ type: "integer", nullable: true })
    retryInterval: number;

    @Column({ type: "varchar", nullable: true })
    messageType: string;

    @Index()
    @Column({ type: "varchar" })
    stage: string;

    @Column({ nullable: true })
    startedAt: Date;

    @Column({ nullable: true })
    finishedAt: Date;

    @Column({ type: "integer", nullable: true })
    elapsedMillis: number;

    @Column({ nullable: true, ...getColumnType('longText') })
    input: string;

    @Column({ nullable: true, ...getColumnType('longText') })
    output: string;

    @Column({ nullable: true, ...getColumnType('longText') })
    error: string;

    @Column({ type: "integer", nullable: true })
    parentEntityId: number;

    @Column({ type: "varchar", nullable: true })
    parentEntity: string;

    @Index()
    @ManyToOne(() => MqMessageQueue, {})
    mqMessageQueue: MqMessageQueue;
}