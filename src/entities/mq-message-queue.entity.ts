import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, OneToMany } from "typeorm";
import { MqMessage } from 'src/entities/mq-message.entity'
@Entity("ss_mq_message_queue")
export class MqMessageQueue extends CommonEntity {
    @Column({ type: "varchar", unique: true })
    name: string;

    @Column({ type: "varchar", nullable: true })
    description: string;

    @OneToMany(() => MqMessage, mqMessage => mqMessage.mqMessageQueue, { cascade: true })
    mqMessages: MqMessage[];
}