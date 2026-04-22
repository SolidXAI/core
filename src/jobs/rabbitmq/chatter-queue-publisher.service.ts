import { Injectable } from '@nestjs/common';

import { RabbitMqPublisher } from 'src/services/queues/rabbitmq-publisher.service';
import chatterQueueOptions from './chatter-queue-options';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { AuditQueuePayload, QueuesModuleOptions } from "../../interfaces";

@Injectable()
export class ChatterQueuePublisherRabbitmq extends RabbitMqPublisher<AuditQueuePayload> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...chatterQueueOptions
        }
    }
}
