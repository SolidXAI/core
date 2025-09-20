import { Injectable, Logger } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions, TriggerMcpClientOptions } from "../../interfaces";
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import triggerMcpClientQueueOptions from "./trigger-mcp-client-queue-options";
import { AiInteractionService } from 'src/services/ai-interaction.service';
import { PollerService } from 'src/services/poller.service';

@Injectable()
export class TriggerMcpClientSubscriberDatabase extends DatabaseSubscriber<TriggerMcpClientOptions> {
    private readonly triggerMcpClientSubscriberLogger = new Logger(TriggerMcpClientSubscriberDatabase.name);

    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
        readonly aiInteractionService: AiInteractionService,
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
    }

    options(): QueuesModuleOptions {
        return {
            ...triggerMcpClientQueueOptions
        }
    }

    async subscribe(message: QueueMessage<TriggerMcpClientOptions>) {
        this.triggerMcpClientSubscriberLogger.debug(`Received message: ${JSON.stringify(message)}`);

        const codeGnerationOptions = message.payload;

        const aiInteraction = await this.aiInteractionService.findOne(codeGnerationOptions.aiInteractionId, {
            populate: ['user']
        });
        if (!aiInteraction) {
            const m = `Unable to identified the aiInteraction entry that triggered this job... using id: ${codeGnerationOptions.aiInteractionId}`
            this.triggerMcpClientSubscriberLogger.log(m);
            throw new Error(m);
        }

        // The message contains the users prompt.
        const prompt = aiInteraction.message;

        // Use this to invoke our mcp client
        // TODO: try / catch ... 
        // Handle the rejection gracefully...
        const aiResponse = await this.aiInteractionService.runMcpPrompt(prompt);
        this.triggerMcpClientSubscriberLogger.log(`aiResponse: `);
        this.triggerMcpClientSubscriberLogger.log(JSON.stringify(aiResponse));

        if (!aiResponse.success) {
            this.triggerMcpClientSubscriberLogger.log(`Gen ai has returned with a false status code`);

            const errorsStr = aiResponse.errors.join('; ');

            await this.aiInteractionService.create({
                userId: aiInteraction.user.id,
                threadId: aiInteraction.threadId,
                parentInteractionId: aiInteraction.id,
                role: 'gen-ai',
                message: '-',
                contentType: aiResponse.content_type,
                errorMessage: errorsStr,
                modelUsed: aiResponse.model,
                responseTimeMs: aiResponse.duration_ms,
                metadata: JSON.stringify(aiResponse, null, 2),
                isApplied: aiInteraction.isApplied,
                status: aiResponse.success ? 'succeeded' : 'failed'
            });

            // update the job entry with failure... raising an error will lead the job to be marked as failed...
            throw new Error(errorsStr);
        }
        else {
            let nestedResponse = aiResponse.response.trim();

            const genAiInteraction = await this.aiInteractionService.create({
                userId: aiInteraction.user.id,
                threadId: aiInteraction.threadId,
                parentInteractionId: aiInteraction.id,
                role: 'gen-ai',
                message: nestedResponse,
                contentType: aiResponse.content_type,
                errorMessage: '',
                modelUsed: aiResponse.model,
                responseTimeMs: aiResponse.duration_ms,
                metadata: JSON.stringify(aiResponse, null, 2),
                isApplied: aiInteraction.isApplied,
                status: aiResponse.success ? 'succeeded' : 'failed'
            });

            // If the human interaction was with isAutoApply=true, then we can go ahead and autoApply.
            if (aiInteraction.isAutoApply) {
                this.aiInteractionService.applySolidAiInteraction(genAiInteraction.id);
            }
        }

        return aiResponse;
    }
}
