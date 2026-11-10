import { Injectable } from '@nestjs/common';

import { RabbitMqSubscriber } from 'src/services/queues/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import mediaMigrationQueueConfig from './media-migration-queue-options';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { MediaMigrationRunnerService } from 'src/services/media-migration/media-migration-runner.service';

/** Runs a media migration job delivered by the RabbitMQ broker. See the database subscriber for details. */
@Injectable()
export class MediaMigrationSubscriber extends RabbitMqSubscriber<{ jobId: number }> {
    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        private readonly runner: MediaMigrationRunnerService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...mediaMigrationQueueConfig
        }
    }

    subscribe(message: QueueMessage<{ jobId: number }>) {
        return this.runner.run(Number(message.payload.jobId));
    }
}
