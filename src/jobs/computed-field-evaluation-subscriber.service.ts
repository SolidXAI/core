import { Injectable, Logger } from "@nestjs/common";
import { SolidRegistry } from "src/helpers/solid-registry";
import { IEntityPostComputeFieldProvider, QueuesModuleOptions } from "src/interfaces";
import { QueueMessage } from "src/interfaces/mq";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { PollerService } from "src/services/poller.service";
import { RabbitMqSubscriber } from "src/services/queues/rabbitmq-subscriber.service";
import { ComputedFieldEvaluationPayload } from "src/subscribers/computed-entity-field.subscriber";
import computedFieldEvaluationQueueOptions from "./computed-field-evaluation-queue-options";

@Injectable()
export class ComputedFieldEvaluationSubscriberRabbitmq extends RabbitMqSubscriber<ComputedFieldEvaluationPayload> {
    private readonly _logger = new Logger(ComputedFieldEvaluationSubscriberRabbitmq.name);
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
            ...computedFieldEvaluationQueueOptions
        }
    }

    // This method will use the ComputedFieldEvaluationPayload to evaluate the computed fields
    // It will then call the corresponding provider computeAndSave method to perform the evaluation
    async subscribe(message: QueueMessage<ComputedFieldEvaluationPayload>) {
        const { databaseEntity, ...computedFieldMetadata } = message.payload;
        const { computedFieldValueProviderName } = computedFieldMetadata;
        const provider = this.solidRegistry.getComputedFieldProvider(computedFieldValueProviderName);
        // Get the instance of the provider and assert it is of type IEntityComputedFieldProvider
        const providerInstance = provider.instance as IEntityPostComputeFieldProvider<any, any>; // IEntityComputedFieldProvider
        if (typeof providerInstance.postComputeAndSaveValue !== 'function') {
            this._logger.warn(`Provider "${computedFieldValueProviderName}" does not implement postComputeAndSaveValue; skipping post-compute.`);
            return;
        }
        await providerInstance.postComputeAndSaveValue(databaseEntity, {
            ...computedFieldMetadata,
            computedFieldValueProviderCtxt: {
                ...(computedFieldMetadata.computedFieldValueProviderCtxt || {}),
            },
        }); //FIXME There should some way to check/assert if the provider actually has a postComputeAndSaveValue
    }
}
