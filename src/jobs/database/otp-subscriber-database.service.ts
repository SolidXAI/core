import { Injectable } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import otpQueueOptions from './otp-queue-options-database';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import { Msg91OTPService } from 'src/services/sms/Msg91OTPService';
import { QueuesModuleOptions } from 'src/interfaces';
import { PollerService } from 'src/services/poller.service';

@Injectable()
export class OTPQueueSubscriberDatabase extends DatabaseSubscriber<any> {
    constructor(
        private readonly otpService: Msg91OTPService,
        readonly mqMessageService: MqMessageService,
        readonly poller: PollerService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
    }

    options(): QueuesModuleOptions {
        return {
            ...otpQueueOptions
        }
    }

    subscribe(message: QueueMessage<any>) {
        this.otpService.sendSMSSynchronously(message);
    }
}
