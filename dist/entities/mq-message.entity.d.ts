import { CommonEntity } from "src/entities/common.entity";
import { MqMessageQueue } from 'src/entities/mq-message-queue.entity';
export declare class MqMessage extends CommonEntity {
    messageId: string;
    retryCount: number;
    retryInterval: number;
    messageType: string;
    stage: string;
    startedAt: Date;
    finishedAt: Date;
    elapsedMillis: number;
    input: any;
    output: any;
    error: any;
    parentEntityId: number;
    parentEntity: string;
    mqMessageQueue: MqMessageQueue;
}
