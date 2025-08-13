import { Injectable } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import smsQueueOptions from './twilio-sms-queue-database-options';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from 'src/interfaces';
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import { TwilioSMSService } from 'src/services/sms/TwilioSMSService';

@Injectable()
export class TwilioSmsQueueSubscriberDatabase extends DatabaseSubscriber<any> {
    constructor(
        private readonly smsService: TwilioSMSService,
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
        this.smsService.sendSMSSynchronously(message);
    }
}
