import { Injectable } from '@nestjs/common';

import { RedisPublisher } from 'src/services/queues/redis-publisher.service';
import otpQueueConfig from './msg91-otp-queue-options-redis';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { QueuesModuleOptions } from "../../interfaces";

@Injectable()
export class Msg91OTPQueuePublisherRedis extends RedisPublisher<any> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...otpQueueConfig
        }
    }
}
