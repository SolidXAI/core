import { Injectable, Logger } from '@nestjs/common';

import { RedisSubscriber } from 'src/services/queues/redis-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import triggerMcpClientQueueConfig from './trigger-mcp-client-queue-options-redis';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { TriggerMcpClientOptions, QueuesModuleOptions } from "../../interfaces";
import { AiInteractionService } from '../../services/ai-interaction.service';
import { PollerService } from '../../services/poller.service';

@Injectable()
export class TriggerMcpClientSubscriberRedis extends RedisSubscriber<TriggerMcpClientOptions> {
    private readonly triggerMcpClientSubscriberLogger = new Logger(TriggerMcpClientSubscriberRedis.name);

    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
        readonly aiInteractionService: AiInteractionService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...triggerMcpClientQueueConfig
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

        const prompt = aiInteraction.message;

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
                metadata: JSON.stringify(aiResponse),
                isApplied: aiInteraction.isApplied,
                status: aiResponse.success ? 'succeeded' : 'failed'
            });

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
                metadata: JSON.stringify(aiResponse),
                isApplied: aiInteraction.isApplied,
                status: aiResponse.success ? 'succeeded' : 'failed'
            });

            if (aiInteraction.isAutoApply) {
                this.aiInteractionService.applySolidAiInteraction(genAiInteraction.id);
            }
        }

        return aiResponse;
    }
}
