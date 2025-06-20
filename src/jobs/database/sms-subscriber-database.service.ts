import { Injectable } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import smsQueueOptions from './sms-queue-database-options';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { Msg91SMSService } from 'src/services/sms/Msg91SMSService';
import { QueuesModuleOptions } from 'src/interfaces';
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';

@Injectable()
export class SmsQueueSubscriberDatabase extends DatabaseSubscriber<any> {
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
        this.smsService.sendSMSSynchronously(message);
    }
}
