import { Injectable } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import smsQueueOptions from './twilio-sms-queue-database-options';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from 'src/interfaces';
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import { TwilioSMSService } from 'src/services/sms/TwilioSMSService';
import { PollerService } from 'src/services/poller.service';
import { SmsFactory } from 'src/factories/sms.factory';

@Injectable()
export class TwilioSmsQueueSubscriberDatabase extends DatabaseSubscriber<any> {
    constructor(
        // private readonly smsService: TwilioSMSService,
        private readonly smsFactory: SmsFactory,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
    }

    options(): QueuesModuleOptions {
        return {
            ...smsQueueOptions
        }
    }

    subscribe(message: QueueMessage<any>) {
        const smsService: TwilioSMSService = this.smsFactory.getSmsService(TwilioSMSService.name) as TwilioSMSService;
        return smsService.sendSMSSynchronously(message);
    }
}
