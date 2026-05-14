import { Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { QueuesModuleOptions } from "../../interfaces";
import { QueueMessage, QueueSubscriber } from '../../interfaces/mq';
import { MqMessageQueueService } from '../mq-message-queue.service';
import { MqMessageService } from '../mq-message.service';
import { buildNamespacedQueueName } from './common';

class ConsumerProcessingTimeoutError extends Error {
    constructor(
        readonly queueName: string,
        readonly messageId: string,
        readonly timeoutMs: number,
    ) {
        super(`Subscriber processing timed out after ${timeoutMs}ms for queue ${queueName} and messageId ${messageId}`);
        this.name = 'ConsumerProcessingTimeoutError';
    }
}


export abstract class RabbitMqSubscriber<T> implements OnModuleInit, QueueSubscriber<T> { // TODO This can be made a generic type for better type visibility
    private _loggerInstance?: Logger;
    private readonly url: string;
    private readonly serviceRole: string;
    private connection: amqp.Connection | null = null;
    private channel: amqp.Channel | null = null;
    private consumerTag: string | null = null;
    private reconnectPromise: Promise<void> | null = null;
    private reconnectAttempt = 0;
    private stopping = false;

    constructor(protected readonly mqMessageService: MqMessageService, protected readonly mqMessageQueueService: MqMessageQueueService) {
        this.url = process.env.QUEUES_RABBIT_MQ_URL;
        this.serviceRole = process.env.QUEUES_SERVICE_ROLE || 'both';
        if (!this.url) {
            this.logger.debug('RabbitMqPublisher url is not defined in the environment variables');
        }
        if (!process.env.QUEUES_SERVICE_ROLE) {
            this.logger.debug('QUEUES_SERVICE_ROLE is not defined. Defaulting RabbitMqSubscriber service role to "both".');
        }
        // this.logger.debug(`RabbitMqSubscriber instance created with options: ${JSON.stringify(this.options())} and url: ${this.url}`);
    }

    protected get loggerContext(): string {
        return this.constructor.name;
    }

    protected get logger(): Logger {
        if (!this._loggerInstance) {
            this._loggerInstance = new Logger(this.loggerContext);
        }
        return this._loggerInstance;
    }

    abstract subscribe(message: QueueMessage<T>): Promise<any>;

    abstract options(): QueuesModuleOptions;

    protected shouldPersistToDatabase(): boolean {
        return this.options().persistToDatabase ?? true;
    }

    async establishConnection(): Promise<amqp.Connection> {

        const url = new URL(this.url);

        // this.logger.debug(`user: ${url.username}`);
        // // just for local debug, don’t log in prod
        // this.logger.debug(`pass: ${url.password}`);
        // this.logger.debug(`path (vhost): ${url.pathname}`);

        const connection = await amqp.connect({
            protocol: url.protocol.replace(':', ''),
            hostname: url.hostname,
            port: parseInt(url.port),
            username: url.username,
            password: decodeURIComponent(url.password),
            frameMax: 131072,
            heartbeat: 30,
        });

        return connection
    }

    async onModuleInit(): Promise<void> {
        // Not using SettingService here as that will necessitate all implementors of RabbitMqSubscriber to also inject SettingService which is not ideal. 
        // Instead we directly read the environment variables here.
        const defaultBroker = process.env.QUEUES_DEFAULT_BROKER || 'database';
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        const queueNameRegex = (process.env.QUEUES_QUEUE_NAME_REGEX_TO_ENABLE || '').trim();
        const roleAllowed = ['both', 'subscriber'].includes(this.serviceRole);

        if (!roleAllowed) {
            this.logger.log(`RabbitMqSubscriber is disabled because QUEUES_SERVICE_ROLE is "${this.serviceRole}". Expected "both" or "subscriber".`);
            return;
        }

        // we will start subscriber only if the current service role is subscriber. 
        if (this.url && solidCliRunning === "false" && defaultBroker === 'rabbitmq') {
            const options = this.options();
            const queueName = options.queueName;

            if (queueNameRegex && queueNameRegex !== "all") {
                try {
                    const regex = new RegExp(queueNameRegex);
                    if (!regex.test(queueName)) {
                        this.logger.log(`RabbitMqSubscriber for queue ${queueName} is disabled because it does not match QUEUES_QUEUE_NAME_REGEX_TO_ENABLE=${queueNameRegex}`);
                        return;
                    }
                } catch (error) {
                    this.logger.error(`Invalid QUEUES_QUEUE_NAME_REGEX_TO_ENABLE regex "${queueNameRegex}". Subscriber for queue ${queueName} will not start.`);
                    return;
                }
            }

            const namespacedQueueName = buildNamespacedQueueName(queueName);
            try {
                await this.connectAndConsume(namespacedQueueName);
            } catch (err) {
                this.logger.error(`Failed to connect to RabbitMQ for queue ${namespacedQueueName}: ${(err as Error).message}`, (err as Error).stack);
                this.triggerReconnect(namespacedQueueName, 'initial connection failure');
            }

            this.logger.log(`RabbitMqSubscriber ready to consume messages: ${JSON.stringify(options)} and url: ${this.url}`);
        }
    }

    private async connectAndConsume(queueName: string): Promise<void> {
        await this.cleanup();
        this.logger.log(`RabbitMqSubscriber in connectAndConsume for queue: ${queueName} and url: ${this.url}`);

        const options = this.options();
        const prefetch = options.prefetch ?? 1;
        if (prefetch < 1) {
            throw new Error(`RabbitMqSubscriber prefetch must be >= 1 for queue ${queueName}`);
        }
        const processingTimeoutMs = this.resolveProcessingTimeoutMs();
        if (processingTimeoutMs > 0) {
            this.logger.log(`RabbitMqSubscriber using processing timeout ${processingTimeoutMs}ms for queue ${queueName}`);
        }

        let connection: amqp.Connection;
        try {
            connection = await this.establishConnection();
        } catch (err) {
            this.logger.error(`Failed to connect to RabbitMQ for queue ${queueName}: ${(err as Error).message}`, (err as Error).stack);
            throw err;
        }

        this.connection = connection;

        connection.on('error', (err) => {
            if (connection !== this.connection) return;
            this.logger.error(`RabbitMqSubscriber connection error for queue ${queueName}: ${(err as Error).message}`);
        });

        connection.on('close', () => {
            if (connection !== this.connection) return;
            this.logger.warn(`RabbitMqSubscriber connection closed for queue ${queueName}`);
            this.triggerReconnect(queueName, 'connection closed');
        });

        const channel = await connection.createChannel();
        this.channel = channel;

        channel.on('error', (err) => {
            if (channel !== this.channel) return;
            this.logger.error(`RabbitMqSubscriber channel error for queue ${queueName}: ${(err as Error).message}`);
        });

        channel.on('close', () => {
            if (channel !== this.channel) return;
            this.logger.warn(`RabbitMqSubscriber channel closed for queue ${queueName}`);
            this.triggerReconnect(queueName, 'channel closed');
        });

        // Process one message at a time per consumer to avoid parallel work on the same subscriber instance.
        await channel.prefetch(prefetch);

        // Use a direct exchange with a stable routing key so retry DLX can route back to the main queue.
        const exchangeName = `${queueName}.exchange`;
        const routingKey = `${queueName}.routing-key`;
        const retryQueue = `${queueName}.retry`;
        const failedQueue = `${queueName}.failed`;

        await channel.assertExchange(exchangeName, 'direct', {});
        await channel.assertQueue(queueName, {});
        await channel.bindQueue(queueName, exchangeName, routingKey);

        // Retry queue uses DLX to route expired messages back to the main exchange/routing key.
        await channel.assertQueue(retryQueue, {
            arguments: {
                'x-dead-letter-exchange': exchangeName,
                'x-dead-letter-routing-key': routingKey,
            }
        });

        await channel.assertQueue(failedQueue, {});

        const consumeResult = await channel.consume(
            queueName,
            async (rawMessage) => {
                if (!rawMessage) {
                    return;
                }

                let message: QueueMessage<T> = null;

                try {
                    const messageContentString = rawMessage.content.toString();
                    message = JSON.parse(messageContentString) as QueueMessage<T>;
                    this.logger.debug(`rabbitmq subscriber received message with id: ${message.messageId} for queue ${queueName}`);
                } catch (error) {
                    this.logger.error(`Invalid JSON message on queue ${queueName}: ${(error as Error).message}`);
                    await this.publishToFailedQueue(queueName, rawMessage.content, channel, error);
                    channel.ack(rawMessage);
                    return;
                }

                if (!message.retryCount) message.retryCount = 0;
                if (!message.retryInterval) message.retryInterval = 1000;
                if (!message.currentRetry) message.currentRetry = 0;

                try {
                    await this.processMessage(message, rawMessage, channel, queueName);
                } catch (error) {
                    await this.handleProcessingError(message, rawMessage, channel, error, queueName);
                }
            },
            // Explicit ack enables reliable processing and retry routing.
            { noAck: false },
        );

        this.consumerTag = consumeResult.consumerTag;
    }

    // Retry flow: update DB -> increment retry -> send to retry queue with per-message expiration -> ack original.
    private async handleProcessingError(message: QueueMessage<T>, rawMessage: amqp.ConsumeMessage, channel: amqp.Channel, error: any, queueName: string): Promise<void> {
        const errorMessage = (error as Error)?.message || String(error);
        this.logger.error(`Error processing message on queue ${queueName}: ${errorMessage}`, (error as Error)?.stack);

        if (message.currentRetry < message.retryCount) {
            if (this.shouldPersistToDatabase()) {
                await this.updateStatusInDatabase('retrying', message);
            }

            message.currentRetry++;
            const retryQueue = `${queueName}.retry`;
            const payload = Buffer.from(JSON.stringify(message));

            // Per-message expiration keeps the message in the retry queue until TTL, then DLX routes it back.
            channel.sendToQueue(retryQueue, payload, {
                expiration: String(message.retryInterval || 1000),
                headers: {
                    'x-error': errorMessage,
                }
            });

            channel.ack(rawMessage);
            this.logger.warn(`Retrying message (${message.currentRetry}/${message.retryCount}) after ${message.retryInterval}ms on queue ${queueName}`);
            return;
        }
        if (this.shouldPersistToDatabase()) {
            await this.updateStatusInDatabase('failed', message, errorMessage, '');
        }
        channel.ack(rawMessage);
        await this.publishToFailedQueue(queueName, Buffer.from(JSON.stringify(message)), channel, error);
        this.logger.error(`Message failed after ${message.retryCount} attempts on queue ${queueName}: ${errorMessage}`);
    }

    private async publishToFailedQueue(queueName: string, payload: Buffer | string, channel: amqp.Channel, error?: any): Promise<void> {
        const failedQueue = `${queueName}.failed`;
        const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
        const errorMessage = (error as Error)?.message || String(error || '');

        try {
            channel.sendToQueue(failedQueue, body, errorMessage ? {
                headers: { 'x-error': errorMessage }
            } : undefined);
        } catch (err) {
            this.logger.error(`Failed to publish to failed queue ${failedQueue}: ${(err as Error).message}`);
        }
    }

    private triggerReconnect(queueName: string, reason: string) {
        if (this.stopping) return;
        if (this.reconnectPromise) return;

        this.reconnectPromise = this.reconnectLoop(queueName, reason)
            .finally(() => {
                this.reconnectPromise = null;
            });
    }

    // Reconnect with backoff to avoid hammering the broker during outages.
    private async reconnectLoop(queueName: string, reason: string): Promise<void> {
        this.logger.warn(`RabbitMqSubscriber reconnecting for queue ${queueName}: ${reason}`);

        while (!this.stopping) {
            try {
                await this.connectAndConsume(queueName);
                this.reconnectAttempt = 0;
                this.logger.log(`RabbitMqSubscriber reconnected for queue ${queueName}`);
                return;
            } catch (err) {
                this.reconnectAttempt += 1;
                const delay = this.backoff();
                this.logger.warn(`RabbitMqSubscriber reconnect failed for queue ${queueName}; retrying in ${delay}ms`);
                await this.sleep(delay);
            }
        }
    }

    private async cleanup(): Promise<void> {
        const channel = this.channel;
        const connection = this.connection;
        const consumerTag = this.consumerTag;

        this.channel = null;
        this.connection = null;
        this.consumerTag = null;

        if (channel) {
            try {
                if (consumerTag) {
                    await channel.cancel(consumerTag);
                }
            } catch (_) {
                // ignore
            }

            try {
                await channel.close();
            } catch (_) {
                // ignore
            }
        }

        if (connection) {
            try {
                await connection.close();
            } catch (_) {
                // ignore
            }
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Exponential backoff with jitter, capped to 30s.
    private backoff(): number {
        const baseMs = 1000;
        const maxMs = 30_000;
        const exp = Math.min(maxMs, baseMs * Math.pow(2, this.reconnectAttempt));
        const jitter = Math.floor(Math.random() * (exp * 0.2));
        return Math.min(maxMs, exp + jitter);
    }

    /**
     * Abstract method for message processing logic.
     */
    protected async processMessage(message: QueueMessage<T>, rawMessage, channel, queueName: string): Promise<void> {
        if (this.shouldPersistToDatabase()) {
            await this.updateStatusInDatabase('started', message);
        }

        // Capture the results of handling the task.
        const result = await this.subscribeWithTimeout(message, queueName);

        // Ack the message. 
        channel.ack(rawMessage);

        // Persist success output and timing.
        if (this.shouldPersistToDatabase()) {
            await this.updateStatusInDatabase('succeeded', message, '', result ? JSON.stringify(result, null, 2) : '');
        }

    }

    private async updateStatusInDatabase(stage: string, message: QueueMessage<T>, error: string = '', result: string = '') {

        // Update the existing message record by messageId; creation happens upstream.
        try {
            // 1. resolve the queue first
            const mqMessage = await this.mqMessageService.repo.findOne({
                where: {
                    messageId: message.messageId,
                }
            });

            if (mqMessage) {
                const updatedFields = {
                    stage: stage
                };
                if (stage === 'failed' || stage === 'succeeded') {
                    updatedFields['finishedAt'] = new Date();
                    updatedFields['elapsedMillis'] = updatedFields['finishedAt'].getTime() - mqMessage.startedAt.getTime();
                }
                if (stage === 'succeeded') {
                    updatedFields['output'] = result;
                }
                if (stage === 'failed') {
                    updatedFields['error'] = error;
                }
                await this.mqMessageService.repo.update(mqMessage.id, updatedFields);
            }
        }
        catch (error: any) {
            this.logger.error(error.message, error.stack);
        }

    }

    private resolveProcessingTimeoutMs(): number {
        // Broker-side delivery-ack timeout (ms). If not provided, assume RabbitMQ default
        // behavior used in this project: 30 minutes.
        // Example (RabbitMQ broker):
        // - Broker ack timeout: 30m => 1,800,000ms (QUEUES_RABBITMQ_CONSUMER_ACK_TIMEOUT_MS)
        // - App soft timeout should be slightly lower, e.g. 29m30s => 1,770,000ms
        //   (QUEUES_RABBITMQ_SUBSCRIBER_PROCESSING_TIMEOUT_MS), so application code fails first,
        //   records DB state/error, and avoids broker-forced channel close as primary failure signal.
        const brokerTimeoutMs = this.parsePositiveInt(process.env.QUEUES_RABBITMQ_CONSUMER_ACK_TIMEOUT_MS, 30 * 60 * 1000);

        // Soft timeout should fire *before* broker timeout so we can fail explicitly,
        // persist status/error, and avoid broker-forced channel closure as primary signal.
        // Keep at least 1s to avoid zero/negative values when broker timeout is very small.
        const defaultSoftTimeoutMs = Math.max(1_000, brokerTimeoutMs - 30_000);

        // Final timeout precedence:
        // 1) QUEUES_RABBITMQ_SUBSCRIBER_PROCESSING_TIMEOUT_MS (if valid positive int)
        // 2) Derived defaultSoftTimeoutMs (broker timeout - 30s)
        return this.parsePositiveInt(process.env.QUEUES_RABBITMQ_SUBSCRIBER_PROCESSING_TIMEOUT_MS, defaultSoftTimeoutMs);
    }

    private parsePositiveInt(value: string | undefined, fallback: number): number {
        // Shared env parsing helper:
        // - missing/invalid/non-positive => fallback
        // - valid positive integer => parsed value
        if (!value) return fallback;
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    private async subscribeWithTimeout(message: QueueMessage<T>, queueName: string): Promise<any> {
        const timeoutMs = this.resolveProcessingTimeoutMs();
        const messageId = message?.messageId || 'unknown';

        // Allow an escape hatch: non-positive timeout means run without a soft timeout.
        if (timeoutMs <= 0) {
            return this.subscribe(message);
        }

        let timedOut = false;
        let timeoutHandle: NodeJS.Timeout | null = null;

        // Main subscriber work promise.
        // If timeout has already fired, suppress rethrow to avoid unhandled rejection noise
        // (the timeout error is already the authoritative failure we track).
        const subscribePromise = Promise.resolve()
            .then(() => this.subscribe(message))
            .catch((error) => {
                if (timedOut) {
                    this.logger.error(
                        `Subscriber promise rejected after timeout for queue ${queueName} and messageId ${messageId}: ${(error as Error)?.message || String(error)}`,
                        (error as Error)?.stack,
                    );
                    return undefined;
                }
                throw error;
            });

        // Timeout promise rejects after timeoutMs with an explicit domain-specific error.
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
                timedOut = true;
                reject(new ConsumerProcessingTimeoutError(queueName, messageId, timeoutMs));
            }, timeoutMs);
        });

        try {
            // Promise.race settles as soon as the *first* promise settles.
            // - If subscribePromise resolves/rejects first, we use that outcome.
            // - If timeoutPromise rejects first, we fail fast with timeout error.
            // This ensures we mark DB status via normal error handling before broker ack-timeout.
            return await Promise.race([subscribePromise, timeoutPromise]);
        } catch (error) {
            const errorMessage = (error as Error)?.message || String(error);
            this.logger.error(
                `Subscriber execution failed for queue ${queueName} and messageId ${messageId}: ${errorMessage}`,
                (error as Error)?.stack,
            );
            throw error;
        } finally {
            // Always clear timer once race settles to avoid timer leaks.
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }

}
