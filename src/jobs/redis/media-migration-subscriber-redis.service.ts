import { Injectable } from '@nestjs/common';

import { RedisSubscriber } from 'src/services/queues/redis-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import mediaMigrationQueueConfig from './media-migration-queue-options-redis';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { MediaMigrationRunnerService } from 'src/services/media-migration/media-migration-runner.service';

/** Runs a media migration job delivered by the Redis broker. See the database subscriber for details. */
@Injectable()
export class MediaMigrationSubscriberRedis extends RedisSubscriber<{ jobId: number }> {
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
