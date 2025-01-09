import { RabbitMqSubscriber } from 'src/services/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageService } from '../services/mq-message.service';
import { MqMessageQueueService } from '../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";
export declare class TestQueueSubscriber extends RabbitMqSubscriber<any> {
    readonly mqMessageService: MqMessageService;
    readonly mqMessageQueueService: MqMessageQueueService;
    constructor(mqMessageService: MqMessageService, mqMessageQueueService: MqMessageQueueService);
    options(): QueuesModuleOptions;
    subscribe(message: QueueMessage<any>): void;
}
