import { Injectable } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import mediaMigrationQueueConfig from './media-migration-queue-options-database';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import { PollerService } from 'src/services/poller.service';
import { MediaMigrationRunnerService } from 'src/services/media-migration/media-migration-runner.service';

/**
 * Runs a media migration job. The whole job runs inside this one call: the job's lease and
 * cursor make it safe to stop and resume, and the poller's per-iteration timeout only stops it
 * waiting, it does not stop the work.
 */
@Injectable()
export class MediaMigrationSubscriberDatabase extends DatabaseSubscriber<{ jobId: number }> {
    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
        private readonly runner: MediaMigrationRunnerService,
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
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
