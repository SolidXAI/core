import { Injectable } from '@nestjs/common';

import { RabbitMqPublisher } from 'src/services/queues/rabbitmq-publisher.service';
import otpQueueOptions from './otp-queue-options';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { MqMessageService } from 'src/services/mq-message.service';
import { QueuesModuleOptions } from "../interfaces";

@Injectable()
export class OTPQueuePublisher extends RabbitMqPublisher<any> {
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
