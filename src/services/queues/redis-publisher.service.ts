import { Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { QueuesModuleOptions } from '../../interfaces';
import { QueueMessage, QueuePublisher } from '../../interfaces/mq';
import { MqMessageQueueService } from '../mq-message-queue.service';
import { MqMessageService } from '../mq-message.service';
import { buildNamespacedQueueName } from './common';

export abstract class RedisPublisher<T> implements OnModuleDestroy, QueuePublisher<T> {
    private readonly logger = new Logger(RedisPublisher.name);
    private readonly serviceRole: string;
    private client: Redis | null = null;

    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        this.serviceRole = process.env.QUEUES_SERVICE_ROLE || 'both';
        if (!process.env.QUEUES_SERVICE_ROLE) {
            this.logger.debug('QUEUES_SERVICE_ROLE is not defined. Defaulting RedisPublisher service role to "both".');
        }
        if (!process.env.QUEUES_REDIS_URL) {
            this.logger.debug('RedisPublisher: QUEUES_REDIS_URL is not defined in the environment variables');
        }
    }

    abstract options(): QueuesModuleOptions;

    private getClient(): Redis {
        if (!this.client) {
            this.client = new Redis(process.env.QUEUES_REDIS_URL);
            this.client.on('error', (err) => {
                this.logger.error(`RedisPublisher connection error: ${err.message}`, err.stack);
            });
        }
        return this.client;
    }

    async onModuleDestroy(): Promise<void> {
        if (this.client) {
            await this.client.quit();
            this.client = null;
        }
    }

    async publish(message: QueueMessage<T>): Promise<string> {
        if (!process.env.QUEUES_REDIS_URL) {
            throw new Error('RedisPublisher: QUEUES_REDIS_URL is not defined in the environment variables');
        }
        if (!this.serviceRole) {
            throw new Error('RedisPublisher: Queue service Role is not defined in the environment variables');
        }
        if (this.serviceRole === 'subscriber') {
            throw new Error('RedisPublisher: Queue service Role is subscriber, cannot publish messages');
        }

        if (!message.retryCount) message.retryCount = 0;
        if (!message.retryInterval) message.retryInterval = 1000;
        message.messageId = uuidv4();

        const queueName = this.options().queueName;
        const namespacedQueueName = buildNamespacedQueueName(queueName);

        await this.persistToDatabase(namespacedQueueName, message);

        try {
            const client = this.getClient();
            await client.publish(namespacedQueueName, JSON.stringify(message));
            this.logger.debug(`RedisPublisher published message ${message.messageId} to channel ${namespacedQueueName}`);
        } catch (err: any) {
            this.logger.error(`RedisPublisher failed to publish message: ${(err as Error).message}`, (err as Error).stack);
        }

        return message.messageId;
    }

    private async persistToDatabase(queueName: string, message: QueueMessage<T>): Promise<void> {
        try {
            const mqMessageQueue = await this.mqMessageQueueService.resolveQueue(queueName);
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
        } catch (error: any) {
            this.logger.error(error.message, error.stack);
        }
    }
}
