import { Injectable, Logger } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions, TriggerMcpClientOptions } from "../../interfaces";
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import generateCodeQueueOptions from './generate-code-queue-options-database';
import { AiInteractionService } from 'src/services/ai-interaction.service';

@Injectable()
export class TriggerMcpClientSubscriberDatabase extends DatabaseSubscriber<TriggerMcpClientOptions> {
    private readonly triggerMcpClientSubscriberLogger = new Logger(TriggerMcpClientSubscriberDatabase.name);

    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly aiInteractionService: AiInteractionService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...generateCodeQueueOptions
        }
    }

    async subscribe(message: QueueMessage<TriggerMcpClientOptions>) {
        this.triggerMcpClientSubscriberLogger.debug(`Received message: ${JSON.stringify(message)}`);

        const codeGnerationOptions = message.payload;

        const aiInteraction = await this.aiInteractionService.findOne(codeGnerationOptions.aiInteractionId, {});

        // The message contains the users prompt.
        const prompt = aiInteraction.message;

        // Use this to invoke our mcp client
        const aiResponse = await this.aiInteractionService.runMcpPrompt(prompt);
        let nestedResponse = aiResponse.response.trim();
        if (!aiResponse.success) {
            // update the job entry with success... raising an error will lead the job to be marked as failed...
            throw new Error(aiResponse.errors.join(','));
        }
        else {
            // TODO: create a new entry not update...
            // const updatedDto = {
            //     ...aiInteraction,
            //     message: nestedResponse,
            // }
            // await this.aiInteractionService.update(codeGnerationOptions.aiInteractionId, updatedDto);

            await this.aiInteractionService.create({
                user: aiInteraction.user,
                threadId: aiInteraction.threadId,
                role: 'gen-ai',
                message: nestedResponse,
                contentType: '',
                errorMessage: '',
                modelUsed: aiResponse.model,
                responseTimeMs: aiResponse.duration_ms,
                metadata: JSON.stringify(aiResponse)
            })
        }

        return `something`;
    }
}
