import { RabbitMqPublisher } from 'src/services/rabbitmq-publisher.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { MqMessageService } from 'src/services/mq-message.service';
import { QueuesModuleOptions } from "../interfaces";
export declare class EmailQueuePublisher extends RabbitMqPublisher<any> {
    protected readonly mqMessageService: MqMessageService;
    protected readonly mqMessageQueueService: MqMessageQueueService;
    constructor(mqMessageService: MqMessageService, mqMessageQueueService: MqMessageQueueService);
    options(): QueuesModuleOptions;
}
