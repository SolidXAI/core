import { Injectable, Logger } from "@nestjs/common";
import { SolidRegistry } from "src/helpers/solid-registry";
import { IEntityComputedFieldProvider, QueuesModuleOptions } from "src/interfaces";
import { QueueMessage } from "src/interfaces/mq";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { DatabaseSubscriber } from "src/services/queues/database-subscriber.service";
import { ComputedFieldEvaluationPayload } from "src/subscribers/computed-entity-field.subscriber";
import computedFieldEvaluationQueueOptions from "./computed-field-evaluation-queue-options";

@Injectable()
export class ComputedFieldEvaluationSubscriber extends DatabaseSubscriber<ComputedFieldEvaluationPayload> {
    private readonly computedFieldEvaluationLogger = new Logger(ComputedFieldEvaluationSubscriber.name);

    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly solidRegistry: SolidRegistry
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
        const provider = this.solidRegistry.getComputedFieldProvider(computedFieldMetadata.computedFieldValueProviderName);
        // Get the instance of the provider and assert it is of type IEntityComputedFieldProvider
        const providerInstance = provider.instance as IEntityComputedFieldProvider<any, any>; // IEntityComputedFieldProvider
        await providerInstance.computeAndSaveValue(databaseEntity, computedFieldMetadata);
    }
}