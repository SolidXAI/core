import { RabbitMqPublisher } from 'src/services/rabbitmq-publisher.service';
import { MqMessageQueueService } from '../services/mq-message-queue.service';
import { MqMessageService } from '../services/mq-message.service';
import { QueuesModuleOptions } from "../interfaces";
export declare class TestQueuePublisher extends RabbitMqPublisher<any> {
    protected readonly mqMessageService: MqMessageService;
    protected readonly mqMessageQueueService: MqMessageQueueService;
    constructor(mqMessageService: MqMessageService, mqMessageQueueService: MqMessageQueueService);
    options(): QueuesModuleOptions;
}
