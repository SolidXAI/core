import { QueueMessage, QueuePublisher } from '../interfaces/mq';
import { MqMessageQueueService } from './mq-message-queue.service';
import { MqMessageService } from './mq-message.service';
import { QueuesModuleOptions } from "../interfaces";
export declare abstract class RabbitMqPublisher<T> implements QueuePublisher<T> {
    protected readonly mqMessageService: MqMessageService;
    protected readonly mqMessageQueueService: MqMessageQueueService;
    private readonly logger;
    constructor(mqMessageService: MqMessageService, mqMessageQueueService: MqMessageQueueService);
    abstract options(): QueuesModuleOptions;
    publish(message: QueueMessage<T>): Promise<string>;
    private persistToDatabase;
}
