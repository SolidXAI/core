import { Logger, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { QueuesModuleOptions } from "../../interfaces";
import { QueueMessage, QueuePublisher } from '../../interfaces/mq';
import { MqMessageQueueService } from '../mq-message-queue.service';
import { MqMessageService } from '../mq-message.service';
import { buildNamespacedQueueName } from './common';

export abstract class RabbitMqPublisher<T> implements OnModuleDestroy, QueuePublisher<T> {
    private readonly logger = new Logger(RabbitMqPublisher.name);
    private readonly url: string;
    private readonly serviceRole: string;

    // Maintain connection...
    private connection: amqp.Connection | null = null;
    private channel: amqp.Channel | null = null;
    private connectingPromise: Promise<void> | null = null;

    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        this.url = process.env.QUEUES_RABBIT_MQ_URL;
        this.serviceRole = process.env.QUEUES_SERVICE_ROLE;
        if (!this.url) {
            this.logger.debug('RabbitMqPublisher url is not defined in the environment variables');
        }
        if (!this.serviceRole) {
            this.logger.debug('Queue service Role is not defined in the environment variables');
        }
        // this.logger.debug(`RabbitMqPublisher instance created with options: ${JSON.stringify(this.options())} and url: ${this.url}`);
    }

    abstract options(): QueuesModuleOptions;

    protected shouldPersistToDatabase(): boolean {
        return this.options().persistToDatabase ?? true;
    }

    private async ensureConnectionAndChannel(): Promise<amqp.Channel> {
        if (this.channel) {
            return this.channel;
        }

        // If another call is already connecting, wait for it
        if (this.connectingPromise) {
            await this.connectingPromise;
            if (this.channel) return this.channel;
        }

        this.connectingPromise = (async () => {
            const url = new URL(this.url);

            const conn = await amqp.connect({
                protocol: url.protocol.replace(':', ''), // "amqps"
                hostname: url.hostname,
                port: parseInt(url.port),
                username: url.username,
                // Node's URL already decodes percent-encoding; decodeURIComponent is not needed
                // But without it does not seem to be working...
                password: decodeURIComponent(url.password),
                frameMax: 131072,
            });

            conn.on('error', (err) => {
                this.logger.error(`RabbitMQ connection error: ${err.message}`, err.stack);
            });

            conn.on('close', () => {
                this.logger.warn('RabbitMQ connection closed, resetting');
                this.connection = null;
                this.channel = null;
            });

            const channel = await conn.createChannel();

            channel.on('return', (msg) => {
                const content = msg.content?.toString?.() ?? '';
                this.logger.warn(
                    `RabbitMqPublisher message returned from exchange ${msg.fields.exchange} with routingKey ${msg.fields.routingKey}: ${content}`,
                );
            });

            const options = this.options();
            const queueName = options.queueName;
            const namespacedQueueName = buildNamespacedQueueName(queueName);
            const exchangeName = `${namespacedQueueName}.exchange`;
            const routingKey = `${namespacedQueueName}.routing-key`;

            await channel.assertExchange(exchangeName, 'direct', {});
            const queue = await channel.assertQueue(namespacedQueueName, {});
            await channel.bindQueue(queue.queue, exchangeName, routingKey);

            this.connection = conn;
            this.channel = channel;
        })();

        try {
            await this.connectingPromise;
        } finally {
            this.connectingPromise = null;
        }

        if (!this.channel) {
            throw new Error('Failed to initialize RabbitMQ channel');
        }

        return this.channel;
    }

    // Nest will call this for every subclass instance, because they inherit the method
    async onModuleDestroy(): Promise<void> {
        await this.closeConnectionAndChannel();
    }

    private async closeConnectionAndChannel(): Promise<void> {
        if (this.channel) {
            try {
                await this.channel.close();
            } catch (err) {
                this.logger.warn(
                    `RabbitMqPublisher error closing channel: ${(err as Error).message}`,
                );
            } finally {
                this.channel = null;
            }
        }

        if (this.connection) {
            try {
                await this.connection.close();
            } catch (err) {
                this.logger.warn(
                    `RabbitMqPublisher error closing connection: ${(err as Error).message}`,
                );
            } finally {
                this.connection = null;
            }
        }
    }

    async publish(message: QueueMessage<T>): Promise<string> {
        if (!this.url) {
            this.logger.error('RabbitMqPublisher url is not defined in the environment variables');
            throw new Error('RabbitMqPublisher url is not defined in the environment variables');
        }
        if (!this.serviceRole) {
            this.logger.error('Queue service Role is not defined in the environment variables');
            throw new Error('Queue service Role is not defined in the environment variables');
        }
        if (this.serviceRole === 'subscriber') {
            this.logger.error('Queue service Role is subscriber, cannot publish messages');
            throw new Error('Queue service Role is subscriber, cannot publish messages');
        }

        const channel = await this.ensureConnectionAndChannel();
        // this.logger.debug(`RabbitMqPublisher publisher channel created options: ${JSON.stringify(this.options())} and url: ${url}`);

        const options = this.options();

        const queueName = options.queueName;
        const namespacedQueueName = buildNamespacedQueueName(queueName);

        const exchangeName = `${namespacedQueueName}.exchange`;
        const routingKey = `${namespacedQueueName}.routing-key`;

        // Set default values for retry. 
        // by default there are no retries.
        if (!message.retryCount) message.retryCount = 0;
        if (!message.retryInterval) message.retryInterval = 1000;

        // generate a new message id 
        message.messageId = uuidv4();

        // Save the message to the DB so that we can then change its status in the subscriber...
        if (this.shouldPersistToDatabase()) {
            await this.persistToDatabase(namespacedQueueName, message);
        }

        // wait for the channel to confirm 
        try {
            // Publish the message
            // const publishStatus = channel.publish(exchangeName, routingKey, Buffer.from(JSON.stringify(message)));
            const publishStatus = channel.publish(exchangeName, routingKey, Buffer.from(JSON.stringify(message)), { mandatory: true });
            // this.logger.debug(`RabbitMqPublisher publish status: ${JSON.stringify(publishStatus)}`);
            // if (!publishStatus) {
            //     this.logger.warn('RabbitMqPublisher Message buffering failed!');
            // }
            // await channel.waitForConfirms();
            // this.logger.debug('RabbitMqPublisher Message published successfully');
        } catch (err) {
            this.logger.error(`RabbitMqPublisher Message publish failed: ${JSON.stringify(err)}`);
            if (err instanceof Error) {
                this.logger.error(`RabbitMqPublisher Error stack: ${err.stack}`);
            }
        }
        finally {
        }
        // this.logger.debug(`Sent message: ${JSON.stringify(message)}`);

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
