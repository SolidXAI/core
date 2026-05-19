import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { QueuesModuleOptions } from '../../interfaces';
import { QueueMessage, QueueSubscriber } from '../../interfaces/mq';
import { MqMessageQueueService } from '../mq-message-queue.service';
import { MqMessageService } from '../mq-message.service';
import { buildNamespacedQueueName } from './common';

export abstract class RedisSubscriber<T> implements OnModuleInit, OnModuleDestroy, QueueSubscriber<T> {
    private readonly logger = new Logger(RedisSubscriber.name);
    private readonly serviceRole: string;
    private client: Redis | null = null;
    private reconnectAttempt = 0;
    private stopping = false;

    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        this.serviceRole = process.env.QUEUES_SERVICE_ROLE || 'both';
        if (!process.env.QUEUES_SERVICE_ROLE) {
            this.logger.debug('QUEUES_SERVICE_ROLE is not defined. Defaulting RedisSubscriber service role to "both".');
        }
        if (!process.env.QUEUES_REDIS_URL) {
            this.logger.debug('RedisSubscriber: QUEUES_REDIS_URL is not defined in the environment variables');
        }
    }

    abstract subscribe(message: QueueMessage<T>): Promise<any>;

    abstract options(): QueuesModuleOptions;

    async onModuleInit(): Promise<void> {
        const defaultBroker = process.env.QUEUES_DEFAULT_BROKER || 'database';
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || 'false';
        const queueNameRegex = (process.env.QUEUES_QUEUE_NAME_REGEX_TO_ENABLE || '').trim();

        if (
            process.env.QUEUES_REDIS_URL &&
            ['both', 'subscriber'].includes(this.serviceRole) &&
            solidCliRunning === 'false' &&
            defaultBroker === 'redis'
        ) {
            const options = this.options();
            const queueName = options.queueName;

            if (queueNameRegex && queueNameRegex !== 'all') {
                try {
                    const regex = new RegExp(queueNameRegex);
                    if (!regex.test(queueName)) {
                        this.logger.log(
                            `RedisSubscriber for queue ${queueName} is disabled because it does not match QUEUES_QUEUE_NAME_REGEX_TO_ENABLE=${queueNameRegex}`,
                        );
                        return;
                    }
                } catch (error: any) {
                    this.logger.error(
                        `Invalid QUEUES_QUEUE_NAME_REGEX_TO_ENABLE regex "${queueNameRegex}". Subscriber for queue ${queueName} will not start.`,
                    );
                    return;
                }
            }

            const namespacedQueueName = buildNamespacedQueueName(queueName);
            await this.connectAndSubscribe(namespacedQueueName);
            this.logger.log(`RedisSubscriber ready to consume messages: ${JSON.stringify(options)}`);
        }
    }

    async onModuleDestroy(): Promise<void> {
        this.stopping = true;
        await this.cleanup();
    }

    private async connectAndSubscribe(channel: string): Promise<void> {
        await this.cleanup();

        const client = new Redis(process.env.QUEUES_REDIS_URL);
        this.client = client;

        client.on('error', (err) => {
            if (client !== this.client) return;
            this.logger.error(`RedisSubscriber connection error for channel ${channel}: ${err.message}`, err.stack);
        });

        client.on('close', () => {
            if (client !== this.client) return;
            this.logger.warn(`RedisSubscriber connection closed for channel ${channel}`);
            this.triggerReconnect(channel, 'connection closed');
        });

        client.on('message', async (receivedChannel, rawMessage) => {
            if (receivedChannel !== channel) return;

            let message: QueueMessage<T> = null;
            try {
                message = JSON.parse(rawMessage) as QueueMessage<T>;
            } catch (error: any) {
                this.logger.error(`RedisSubscriber invalid JSON on channel ${channel}: ${(error as Error).message}`);
                return;
            }

            if (!message.retryCount) message.retryCount = 0;
            if (!message.retryInterval) message.retryInterval = 1000;
            if (!message.currentRetry) message.currentRetry = 0;

            try {
                await this.processMessage(message);
            } catch (error: any) {
                await this.handleProcessingError(message, error, channel);
            }
        });

        await client.subscribe(channel);
        this.reconnectAttempt = 0;
    }

    private async handleProcessingError(message: QueueMessage<T>, error: any, channel: string): Promise<void> {
        const errorMessage = (error as Error)?.message || String(error);
        this.logger.error(`Error processing message on channel ${channel}: ${errorMessage}`);

        if (message.currentRetry < message.retryCount) {
            await this.updateStatusInDatabase('retrying', message);
            message.currentRetry++;
            this.logger.warn(
                `Retrying message (${message.currentRetry}/${message.retryCount}) after ${message.retryInterval}ms on channel ${channel}`,
            );
            setTimeout(async () => {
                try {
                    await this.processMessage(message);
                } catch (retryError) {
                    await this.handleProcessingError(message, retryError, channel);
                }
            }, message.retryInterval);
        } else {
            await this.updateStatusInDatabase('failed', message, errorMessage, '');
            this.logger.error(`Message failed after ${message.retryCount} attempts on channel ${channel}: ${errorMessage}`);
        }
    }

    private triggerReconnect(channel: string, reason: string): void {
        if (this.stopping) return;

        this.reconnectAttempt++;
        const delay = this.backoff();
        this.logger.warn(`RedisSubscriber reconnecting for channel ${channel} (${reason}) in ${delay}ms`);

        setTimeout(async () => {
            if (this.stopping) return;
            try {
                await this.connectAndSubscribe(channel);
                this.logger.log(`RedisSubscriber reconnected for channel ${channel}`);
            } catch (err: any) {
                this.triggerReconnect(channel, `reconnect failed: ${(err as Error).message}`);
            }
        }, delay);
    }

    private async cleanup(): Promise<void> {
        const client = this.client;
        this.client = null;

        if (client) {
            try {
                await client.quit();
            } catch (_) {
                // ignore
            }
        }
    }

    private backoff(): number {
        const baseMs = 1000;
        const maxMs = 30_000;
        const exp = Math.min(maxMs, baseMs * Math.pow(2, this.reconnectAttempt));
        const jitter = Math.floor(Math.random() * (exp * 0.2));
        return Math.min(maxMs, exp + jitter);
    }

    protected async processMessage(message: QueueMessage<T>): Promise<void> {
        await this.updateStatusInDatabase('started', message);
        const result: any = await (this.subscribe(message) as any);
        await this.updateStatusInDatabase('succeeded', message, '', result != null ? JSON.stringify(result, null, 2) : '');
    }

    private async updateStatusInDatabase(
        stage: string,
        message: QueueMessage<T>,
        error: string = '',
        result: string = '',
    ): Promise<void> {
        try {
            const mqMessage = await this.mqMessageService.repo.findOne({
                where: { messageId: message.messageId },
            });

            if (mqMessage) {
                const updatedFields: Record<string, any> = { stage };
                if (stage === 'failed' || stage === 'succeeded') {
                    updatedFields['finishedAt'] = new Date();
                    updatedFields['elapsedMillis'] = updatedFields['finishedAt'].getTime() - mqMessage.startedAt.getTime();
                }
                if (stage === 'succeeded') updatedFields['output'] = result;
                if (stage === 'failed') updatedFields['error'] = error;
                await this.mqMessageService.repo.update(mqMessage.id, updatedFields);
            }
        } catch (err: any) {
            this.logger.error(err.message, err.stack);
        }
    }
}
