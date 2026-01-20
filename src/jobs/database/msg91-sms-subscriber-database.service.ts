import { Injectable } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import smsQueueOptions from './msg91-sms-queue-database-options';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { Msg91SMSService } from 'src/services/sms/Msg91SMSService';
import { QueuesModuleOptions } from 'src/interfaces';
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import { PollerService } from 'src/services/poller.service';
import { SmsFactory } from 'src/factories/sms.factory';

@Injectable()
export class Msg91SmsQueueSubscriberDatabase extends DatabaseSubscriber<any> {
    constructor(
        // private readonly smsService: Msg91SMSService,
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
        const smsService: Msg91SMSService = this.smsFactory.getSmsService(Msg91SMSService.name) as Msg91SMSService;
        return smsService.sendSMSSynchronously(message);

        // return this.smsService.sendSMSSynchronously(message);
    }
}
