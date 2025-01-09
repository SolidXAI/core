import { RabbitMqSubscriber } from 'src/services/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import { Msg91SMSService } from '../services/sms/Msg91SMSService';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";
export declare class SmsQueueSubscriber extends RabbitMqSubscriber<any> {
    private readonly smsService;
    readonly mqMessageService: MqMessageService;
    readonly mqMessageQueueService: MqMessageQueueService;
    constructor(smsService: Msg91SMSService, mqMessageService: MqMessageService, mqMessageQueueService: MqMessageQueueService);
    options(): QueuesModuleOptions;
    subscribe(message: QueueMessage<any>): void;
}
