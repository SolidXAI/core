import { RabbitMqSubscriber } from 'src/services/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import { Msg91WhatsappService } from '../services/whatsapp/Msg91WhatsappService';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";
export declare class WhatsappQueueSubscriber extends RabbitMqSubscriber<any> {
    private readonly whatsappService;
    readonly mqMessageService: MqMessageService;
    readonly mqMessageQueueService: MqMessageQueueService;
    constructor(whatsappService: Msg91WhatsappService, mqMessageService: MqMessageService, mqMessageQueueService: MqMessageQueueService);
    options(): QueuesModuleOptions;
    subscribe(message: QueueMessage<any>): void;
}
