import { Injectable } from '@nestjs/common';

import { QueuesModuleOptions } from '../../interfaces';
import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { MqMessageService } from 'src/services/mq-message.service';
import { PollerService } from 'src/services/poller.service';
import { TwilioSMSService } from 'src/services/sms/TwilioSMSService';
import smsQueueOptions from './twilio-sms-queue-options';
import { RabbitMqSubscriber } from 'src/services/queues/rabbitmq-subscriber.service';
import { SmsFactory } from 'src/factories/sms.factory';

@Injectable()
export class TwilioSmsQueueSubscriberRabbitmq extends RabbitMqSubscriber<any> {
    constructor(
        // private readonly smsService: TwilioSMSService,
        private readonly smsFactory: SmsFactory,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...smsQueueOptions
        }
    }

    subscribe(message: QueueMessage<any>) {
        const smsService: TwilioSMSService = this.smsFactory.getSmsService(TwilioSMSService.name) as TwilioSMSService;
        return smsService.sendSMSSynchronously(message);
        // return this.smsService.sendSMSSynchronously(message);
    }
}
