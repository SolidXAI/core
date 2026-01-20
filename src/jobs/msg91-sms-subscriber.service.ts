import { Injectable } from '@nestjs/common';

import { RabbitMqSubscriber } from 'src/services/queues/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import smsQueueOptions from './msg91-sms-queue-options';
import { Msg91SMSService } from '../services/sms/Msg91SMSService';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";
import { SmsFactory } from 'src/factories/sms.factory';

@Injectable()
export class Msg91SmsQueueSubscriber extends RabbitMqSubscriber<any> {
    constructor(
        // private readonly smsService: Msg91SMSService,
        private readonly smsFactory: SmsFactory,
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
        const smsService: Msg91SMSService = this.smsFactory.getSmsService(Msg91SMSService.name) as Msg91SMSService;
        return smsService.sendSMSSynchronously(message);

        // return this.smsService.sendSMSSynchronously(message);
    }
}
