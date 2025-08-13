import { Injectable } from "@nestjs/common";
import { SolidRegistry } from "src/helpers/solid-registry";
import { IEntityPostComputeFieldProvider, IEntityComputedFieldProvider, QueuesModuleOptions } from "src/interfaces";
import { QueueMessage } from "src/interfaces/mq";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { DatabaseSubscriber } from "src/services/queues/database-subscriber.service";
import { ComputedFieldEvaluationPayload } from "src/subscribers/computed-entity-field.subscriber";
import computedFieldEvaluationQueueOptions from "./computed-field-evaluation-queue-options";
import { PollerService } from "src/services/poller.service";

@Injectable()
export class ComputedFieldEvaluationSubscriber extends DatabaseSubscriber<ComputedFieldEvaluationPayload> {
    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly solidRegistry: SolidRegistry,
        readonly poller: PollerService,
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
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
        const provider = this.solidRegistry.getComputedFieldProvider(computedFieldMetadata.computedFieldValueProviderName);
        // Get the instance of the provider and assert it is of type IEntityComputedFieldProvider
        const providerInstance = provider.instance as IEntityPostComputeFieldProvider<any, any>; // IEntityComputedFieldProvider
        await providerInstance.postComputeAndSaveValue(databaseEntity, computedFieldMetadata); //FIXME There should some way to check/assert if the provider actually has a postComputeAndSaveValue
    }
}