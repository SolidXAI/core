import { Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { QueuesModuleOptions } from "../../interfaces";
import { QueueMessage, QueuePublisher } from '../../interfaces/mq';
import { MqMessageQueueService } from '../mq-message-queue.service';
import { MqMessageService } from '../mq-message.service';

export abstract class RabbitMqPublisher<T> implements QueuePublisher<T> {
    private readonly logger = new Logger(RabbitMqPublisher.name);
    private readonly url: string;
    private readonly serviceRole: string;

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
        this.logger.debug(`RabbitMqPublisher instance created with options: ${JSON.stringify(this.options())} and url: ${this.url}`);
    }

    abstract options(): QueuesModuleOptions;

    async establishConnection(): Promise<amqp.Connection> {

        const url = new URL(this.url);

        const connection = await amqp.connect({
            protocol: url.protocol.replace(':', ''),
            hostname: url.hostname,
            port: parseInt(url.port),
            username: url.username,
            password: url.password,
            frameMax: 131072,
        });

        return connection
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

        this.logger.debug(`RabbitMqPublisher publishing with options: ${JSON.stringify(this.options())} and url: ${this.url}`);

        // const connection = await amqp.connect(this.url);
        const connection = await this.establishConnection();
        // this.logger.debug(`RabbitMqPublisher publisher connected options: ${JSON.stringify(this.options())} and url: ${url}`);

        const channel = await connection.createChannel();
        // this.logger.debug(`RabbitMqPublisher publisher channel created options: ${JSON.stringify(this.options())} and url: ${url}`);

        const options = this.options();

        const queueName = options.queueName;
        const exchangeName = `${queueName}.exchange`;
        const routingKey = `${queueName}.routing-key`;

        await channel.assertExchange(exchangeName, 'direct', {});
        // this.logger.debug(`RabbitMqPublisher channel asserted: ${JSON.stringify(this.options())} and url: ${url}`);

        const queue = await channel.assertQueue(queueName, {});
        // this.logger.debug(`RabbitMqPublisher queue asserted: ${JSON.stringify(this.options())} and url: ${url}`);

        await channel.bindQueue(queue.queue, exchangeName, routingKey);
        // this.logger.debug(`RabbitMqPublisher queue bound: ${JSON.stringify(this.options())} and url: ${url}`);

        // Set default values for retry. 
        // by default there are no retries.
        if (!message.retryCount) message.retryCount = 0;
        if (!message.retryInterval) message.retryInterval = 1000;

        // generate a new message id 
        message.messageId = uuidv4();

        // Save the message to the DB so that we can then change its status in the subscriber...
        await this.persistToDatabase(queueName, message);

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
            // TODO: check if we want to do this or keep the connection open all the time. 
            // connection.close();
            // setTimeout(() => {
            //     connection.close();
            //     this.logger.error('RabbitMqPublisher connection closed');
            // }, 3000);
        }
        // this.logger.debug(`Sent message: ${JSON.stringify(message)}`);

        // TODO: check if we want to do this or keep the connection open all the time. 
        // setTimeout(() => {
        //     connection.close();
        // }, 500);

        // return the newly created message id.
        return message.messageId;
    }

    private async persistToDatabase(queueName: string, message: QueueMessage<T>) {

        // TODO: make an entry in the relevant database table, generate a unique id earlier.
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
