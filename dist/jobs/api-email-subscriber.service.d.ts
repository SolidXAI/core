import { RabbitMqSubscriber } from 'src/services/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import { ElasticEmailService } from '../services/mail/ElasticEmailService';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";
export declare class ApiEmailQueueSubscriber extends RabbitMqSubscriber<any> {
    private readonly emailService;
    readonly mqMessageService: MqMessageService;
    readonly mqMessageQueueService: MqMessageQueueService;
    constructor(emailService: ElasticEmailService, mqMessageService: MqMessageService, mqMessageQueueService: MqMessageQueueService);
    options(): QueuesModuleOptions;
    subscribe(message: QueueMessage<any>): void;
}
