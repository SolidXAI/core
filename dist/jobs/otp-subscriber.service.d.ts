import { QueueMessage } from 'src/interfaces/mq';
import { RabbitMqSubscriber } from 'src/services/rabbitmq-subscriber.service';
import { Msg91OTPService } from '../services/sms/Msg91OTPService';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";
export declare class OTPQueueSubscriber extends RabbitMqSubscriber<any> {
    private readonly otpService;
    readonly mqMessageService: MqMessageService;
    readonly mqMessageQueueService: MqMessageQueueService;
    constructor(otpService: Msg91OTPService, mqMessageService: MqMessageService, mqMessageQueueService: MqMessageQueueService);
    options(): QueuesModuleOptions;
    subscribe(message: QueueMessage<any>): void;
}
