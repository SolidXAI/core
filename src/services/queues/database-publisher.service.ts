import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { QueuesModuleOptions } from "../../interfaces";
import { QueueMessage, QueuePublisher } from '../../interfaces/mq';
import { MqMessageQueueService } from '../mq-message-queue.service';
import { MqMessageService } from '../mq-message.service';

export abstract class DatabasePublisher<T> implements QueuePublisher<T> {
    private readonly logger = new Logger(DatabasePublisher.name);
    private readonly url: string;
    private readonly serviceRole: string;

    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        this.serviceRole = process.env.QUEUES_SERVICE_ROLE;
        if (!this.serviceRole) {
            this.logger.debug('Queue service Role is not defined in the environment variables');
        }
        this.logger.debug(`DatabasePublisher instance created with options: ${JSON.stringify(this.options())} and url: ${this.url}`);
    }

    abstract options(): QueuesModuleOptions;

    async publish(message: QueueMessage<T>): Promise<string> {
        if (!this.serviceRole) {
            this.logger.error('Queue service Role is not defined in the environment variables');
            throw new Error('Queue service Role is not defined in the environment variables');
        }
        if (this.serviceRole === 'subscriber') {
            this.logger.error('Queue service Role is subscriber, cannot publish messages');
            throw new Error('Queue service Role is subscriber, cannot publish messages');
        }

        this.logger.debug(`DatabasePublisher publishing with options: ${JSON.stringify(this.options())} and url: ${this.url}`);

        const options = this.options();

        const queueName = options.queueName;
        if (!message.retryCount) message.retryCount = 0;
        if (!message.retryInterval) message.retryInterval = 1000;

        // generate a new message id 
        message.messageId = uuidv4();

        // Save the message to the DB so that we can then change its status in the subscriber...
        await this.persistToDatabase(queueName, message);

        // return the newly created message id.
        return message.messageId;
    }

    private async persistToDatabase(queueName: string, message: QueueMessage<T>) {
        // make an entry in the relevant database table, generate a unique id earlier.
        try {
            // 1. resolve the queue first
            const mqMessageQueue = await this.mqMessageQueueService.resolveQueue(queueName);

            // 2. Next create an entry in the mqMessage table. 
            await this.mqMessageService.create({
                messageBroker: this.options().type,
                messageId: message.messageId,
                retryCount: message.retryCount,
                retryInterval: message.retryInterval,
                stage: 'pending',
                startedAt: new Date(),
                input: JSON.stringify(message, null, 2),
                parentEntityId: message.parentEntityId,
                parentEntity: message.parentEntity,
                mqMessageQueueId: mqMessageQueue.id,
            });
        }
        catch (error) {
            this.logger.error(error.message, error.stack);
        }

    }
}
