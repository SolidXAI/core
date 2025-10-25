import { Injectable, Logger } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { McpResponse, QueuesModuleOptions, TriggerMcpClientOptions } from "../../interfaces";
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import triggerMcpClientQueueOptions from "./trigger-mcp-client-queue-options";
import { AiInteractionService } from 'src/services/ai-interaction.service';
import { PollerService } from 'src/services/poller.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';

@Injectable()
export class TriggerMcpClientSubscriberDatabase extends DatabaseSubscriber<TriggerMcpClientOptions> {
    private readonly triggerMcpClientSubscriberLogger = new Logger(TriggerMcpClientSubscriberDatabase.name);

    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
        readonly aiInteractionService: AiInteractionService,
        readonly moduleMetadataService: ModuleMetadataService,
        readonly modelMetadataService: ModelMetadataService
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
    }

    options(): QueuesModuleOptions {
        return {
            ...triggerMcpClientQueueOptions
        }
    }

    cleanNestedResponse(aiResponse: McpResponse) {
        let nestedResponse: any;

        try {
            let raw = aiResponse.response;

            if (typeof raw === "string") {
                raw = raw.trim();
                try {
                    // Try to parse as JSON
                    nestedResponse = JSON.parse(raw);
                } catch {
                    // Not JSON, just keep as string
                    nestedResponse = raw;
                }
            } else if (typeof raw === "object" && raw !== null) {
                // Already JSON
                nestedResponse = raw;
            } else {
                // Fallback
                nestedResponse = String(raw);
            }
        } catch (err) {
            this.triggerMcpClientSubscriberLogger.error("Error processing AI response:", err);
            nestedResponse = `Error handling response: ${err?.message || String(err)}`;
        }

        return nestedResponse;
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

        // We create the aiInteraction entry first 
        const genAiInteraction = await this.aiInteractionService.create({
            userId: aiInteraction.user.id,
            threadId: aiInteraction.threadId,
            parentInteractionId: aiInteraction.id,
            role: 'gen-ai',
            message: '...', // Updated in the tool
            contentType: '', // Updated in the tool
            errorMessage: '', // Updated after we receive the response
            modelUsed: '', // Updated after we receive the response
            responseTimeMs: 0, // Updated after we receive the response
            metadata: '', // Updated in the tool
            isApplied: false, // Updated after we receive the response
            status: 'pending' // Updated after we receive the response
        });

        const existing_modules = await this.moduleMetadataService.findMany({ limit: 100, offset: 0 });
        const existing_models = await this.modelMetadataService.findMany({ limit: 100, offset: 0, populate: ['module'] });


        // Build the dynamic existing modules list
        const existingModulesList = existing_modules.records
            .map(
                (module) => `
### ${module.displayName}
- name: ${module.name}
- description: ${module.description || "No description"}
`).join("\n");

        const existingModelsList = existing_models.records
            .map(
                (model) => `
### ${model.displayName}
- singularName: ${model.singularName}
- description: ${model.description || "No description"}
- moduleName: ${model.module.name || "Unknown"}
`).join("\n");


        const finalPrompt = `
# User Prompt: 
${prompt}

# System Instructions:
- aiInteractionId: ${genAiInteraction.id}
- You will be invoking tools if needed, hence you will have to choose the applicable tools based on the tool context given to you.
- If a tool is invoked, you must return **exactly** the raw output from the tool, without any json envelopes, additional formatting, commentary, or text.
- Do not wrap the result in quotes, JSON, or markdown fences.
- Do not explain what the result means.

# LISTS TO RESOLVE MODULE & MODEL

## LIST OF EXISTING MODULES
Use the below list of models with module names to infer which module & models the user is referring to, you can try to pull out the singularName incase of models.

${existingModulesList}
## LIST OF EXISTING MODELS
Use the below list of modules to infer which module the user is referring to.

${existingModelsList}`


        const aiResponse = await this.aiInteractionService.runMcpPrompt(finalPrompt);
        this.triggerMcpClientSubscriberLogger.log(`aiResponse: `);
        this.triggerMcpClientSubscriberLogger.log(JSON.stringify(aiResponse));

        if (!aiResponse.success) {
            this.triggerMcpClientSubscriberLogger.log(`Gen ai has returned with a false status code`);

            const errorsStr = aiResponse.errors?.join('\n ');
            const errorTrace = aiResponse.error_trace?.join('\n');

            // await this.aiInteractionService.create({
            //     userId: aiInteraction.user.id,
            //     threadId: aiInteraction.threadId,
            //     parentInteractionId: aiInteraction.id,
            //     role: 'gen-ai',
            //     message: '-',
            //     contentType: aiResponse.content_type,
            //     errorMessage: errorsStr,
            //     modelUsed: aiResponse.model,
            //     responseTimeMs: aiResponse.duration_ms,
            //     metadata: JSON.stringify(aiResponse, null, 2),
            //     isApplied: aiInteraction.isApplied,
            //     status: aiResponse.success ? 'succeeded' : 'failed'
            // });

            // TODO: Update the previously created genAiInteraction record with the respective error fields and save to DB
            await this.aiInteractionService.update(genAiInteraction.id, {
                // contentType: aiResponse.content_type,
                errorMessage: `${errorsStr}\n\n${errorTrace}`,
                modelUsed: aiResponse.model,
                responseTimeMs: aiResponse.duration_ms,
                isApplied: aiInteraction.isApplied,
                status: aiResponse.success ? 'succeeded' : 'failed'
            }, [], true);

            // update the job entry with failure... raising an error will lead the job to be marked as failed...
            throw new Error(errorsStr);
        }
        else {
            let nestedResponse = this.cleanNestedResponse(aiResponse);

            // const genAiInteraction = await this.aiInteractionService.create({
            //     userId: aiInteraction.user.id,
            //     threadId: aiInteraction.threadId,
            //     parentInteractionId: aiInteraction.id,
            //     role: 'gen-ai',
            //     message: nestedResponse,
            //     contentType: aiResponse.content_type,
            //     errorMessage: '',
            //     modelUsed: aiResponse.model,
            //     responseTimeMs: aiResponse.duration_ms,
            //     metadata: JSON.stringify(aiResponse, null, 2),
            //     isApplied: aiInteraction.isApplied,
            //     status: aiResponse.success ? 'succeeded' : 'failed'
            // });

            // TODO: Update the previously created genAiInteraction record with the respective success fields and save to DB
            const errorsStr = nestedResponse?.status == "error" && nestedResponse?.errors.join('\n ');
            // const errorTrace = nestedResponse?.status == "error" && nestedResponse?.error_trace?.join('\n');


            await this.aiInteractionService.update(genAiInteraction.id, {
                errorMessage: nestedResponse.status == "error" ? `${errorsStr}` : "",
                // errorMessage:"",
                // contentType: aiResponse.content_type,
                // message: nestedResponse,
                modelUsed: aiResponse.model,
                responseTimeMs: aiResponse.duration_ms,
                isApplied: aiInteraction.isApplied,

                // status: aiResponse.success ? 'succeeded' : 'failed'
                status: aiResponse.success && nestedResponse.status == "success" ? 'succeeded' : 'failed'
            }, [], true);

            // If the human interaction was with isAutoApply=true, then we can go ahead and autoApply.
            if (aiInteraction.isAutoApply) {
                this.aiInteractionService.applySolidAiInteraction(genAiInteraction.id);
            }
        }

        return aiResponse;
    }
}
