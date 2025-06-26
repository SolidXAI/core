import { Injectable } from '@nestjs/common';

import otpQueueOptions from './otp-queue-options-database';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { MqMessageService } from 'src/services/mq-message.service';
import { DatabasePublisher } from 'src/services/queues/database-publisher.service';
import { QueuesModuleOptions } from 'src/interfaces';

@Injectable()
export class OTPQueuePublisherDatabase extends DatabasePublisher<any> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...otpQueueOptions
        }
    }
}
