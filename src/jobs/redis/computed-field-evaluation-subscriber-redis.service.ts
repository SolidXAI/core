import { Injectable, Logger } from '@nestjs/common';

import { RedisSubscriber } from 'src/services/queues/redis-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import computedFieldEvaluationQueueConfig from './computed-field-evaluation-queue-options-redis';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { IEntityPostComputeFieldProvider, QueuesModuleOptions } from "../../interfaces";
import { ComputedFieldEvaluationPayload } from 'src/subscribers/computed-entity-field.subscriber';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { PollerService } from '../../services/poller.service';

@Injectable()
export class ComputedFieldEvaluationSubscriberRedis extends RedisSubscriber<ComputedFieldEvaluationPayload> {
    private readonly _logger = new Logger(ComputedFieldEvaluationSubscriberRedis.name);

    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly solidRegistry: SolidRegistry,
        readonly poller: PollerService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...computedFieldEvaluationQueueConfig
        }
    }

    async subscribe(message: QueueMessage<ComputedFieldEvaluationPayload>) {
        const { databaseEntity, ...computedFieldMetadata } = message.payload;
        const { computedFieldValueProviderName } = computedFieldMetadata;
        const provider = this.solidRegistry.getComputedFieldProvider(computedFieldValueProviderName);
        const providerInstance = provider.instance as IEntityPostComputeFieldProvider<any, any>;
        if (typeof providerInstance.postComputeAndSaveValue !== 'function') {
            this._logger.warn(`Provider "${computedFieldValueProviderName}" does not implement postComputeAndSaveValue; skipping post-compute.`);
            return;
        }
        await providerInstance.postComputeAndSaveValue(databaseEntity, {
            ...computedFieldMetadata,
            computedFieldValueProviderCtxt: {
                ...(computedFieldMetadata.computedFieldValueProviderCtxt || {}),
            },
        });
    }
}
