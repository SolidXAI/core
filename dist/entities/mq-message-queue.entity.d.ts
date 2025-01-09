import { CommonEntity } from "src/entities/common.entity";
import { MqMessage } from 'src/entities/mq-message.entity';
export declare class MqMessageQueue extends CommonEntity {
    name: string;
    description: string;
    mqMessages: MqMessage[];
}
