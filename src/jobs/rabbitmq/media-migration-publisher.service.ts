import { Injectable } from '@nestjs/common';

import { RabbitMqPublisher } from 'src/services/queues/rabbitmq-publisher.service';
import mediaMigrationQueueConfig from './media-migration-queue-options';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { QueuesModuleOptions } from "../../interfaces";

/** Queues a media migration job by id, on the RabbitMQ broker. */
@Injectable()
export class MediaMigrationPublisher extends RabbitMqPublisher<{ jobId: number }> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...mediaMigrationQueueConfig
        }
    }
}
