import { Injectable } from '@nestjs/common';

import { RabbitMqSubscriber } from 'src/services/queues/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import smsQueueOptions from './sms-queue-options';
import { Msg91SMSService } from '../services/sms/Msg91SMSService';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";

@Injectable()
export class SmsQueueSubscriber extends RabbitMqSubscriber<any> {
    constructor(
        private readonly smsService: Msg91SMSService,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...smsQueueOptions
        }
    }

    subscribe(message: QueueMessage<any>) {
        return this.smsService.sendSMSSynchronously(message);
    }
}
