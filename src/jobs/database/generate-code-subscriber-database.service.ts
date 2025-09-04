import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { CodeGenerationOptions, QueuesModuleOptions } from "../../interfaces";
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import generateCodeQueueOptions from './generate-code-queue-options-database';
import { SolidFieldType } from 'src/dtos/create-field-metadata.dto';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { PollerService } from 'src/services/poller.service';

@Injectable()
export class GenerateCodeSubscriberDatabase extends DatabaseSubscriber<CodeGenerationOptions> {
    private readonly generateCodeSubscriberLogger = new Logger(GenerateCodeSubscriberDatabase.name);

    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
        @Inject(forwardRef(() => ModelMetadataService))
        readonly modelMetadataService: ModelMetadataService,
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
    }

    options(): QueuesModuleOptions {
        return {
            ...generateCodeQueueOptions
        }
    }

    async subscribe(message: QueueMessage<CodeGenerationOptions>) {
        this.generateCodeSubscriberLogger.debug(`Received message: ${JSON.stringify(message)}`);

        const codeGnerationOptions = message.payload;

        const { model, removeFieldCodeOuput, refreshModelCodeOutput } = await this.modelMetadataService.generateCode(codeGnerationOptions);

        // Generate the code for models which are linked to fields having an inverse relation
        const coModelSingularNames = model.fields.
            filter(field => field.type === SolidFieldType.relation && field.relationCreateInverse === true)
            .map(field => field.relationCoModelSingularName);

        for (const singularName of coModelSingularNames) {
            const coModel = await this.modelMetadataService.findOneBySingularName(singularName);
            const inverseOptions: CodeGenerationOptions = {
                modelId: coModel.id,
                dryRun: codeGnerationOptions.dryRun
            };
            await this.modelMetadataService.generateCode(inverseOptions);
        }

        await this.modelMetadataService.generateVAMConfig(model.id);

        return `${removeFieldCodeOuput} \n ${refreshModelCodeOutput}`;
    }
}
