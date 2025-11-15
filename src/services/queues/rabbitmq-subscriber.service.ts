import { Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { QueuesModuleOptions } from "../../interfaces";
import { QueueMessage, QueueSubscriber } from '../../interfaces/mq';
import { MqMessageQueueService } from '../mq-message-queue.service';
import { MqMessageService } from '../mq-message.service';


export abstract class RabbitMqSubscriber<T> implements OnModuleInit, QueueSubscriber<T> { // TODO This can be made a generic type for better type visibility
    private readonly logger = new Logger(RabbitMqSubscriber.name);
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
        // this.logger.debug(`RabbitMqSubscriber instance created with options: ${JSON.stringify(this.options())} and url: ${this.url}`);
    }

    abstract subscribe(message: QueueMessage<T>);

    abstract options(): QueuesModuleOptions;

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
        });

        return connection
    }

    async onModuleInit(): Promise<void> {
        // we will start subscriber only if the current service role is subscriber. 
        if (this.url && ['both', 'subscriber'].includes(this.serviceRole)) {

            // this.logger.debug(`RabbitMqSubscriber instance created with options: ${JSON.stringify(this.options())} and url: ${this.url}`);
            // const connection = await amqp.connect(this.url);

            let connection;
            try {
                connection = await this.establishConnection();
                // this.logger.debug(`RabbitMqSubscriber connection established: ${JSON.stringify(this.options())} and url: ${this.url}`);
            }
            catch (err) {
                this.logger.error(`Failed to connect to RabbitMQ: ${(err as Error).message}`, (err as Error).stack);
                throw err;
            }

            const channel = await connection.createChannel();
            // this.logger.debug(`RabbitMqSubscriber channel created: ${JSON.stringify(this.options())} and url: ${url}`);

            const options = this.options();

            const queueName = options.queueName;
            const exchangeName = `${queueName}.exchange`;
            const routingKey = `${queueName}.routing-key`;

            await channel.assertExchange(exchangeName, 'direct', {});
            // this.logger.debug(`RabbitMqSubscriber channel asserted: ${JSON.stringify(this.options())} and url: ${url}`);

            const queue = await channel.assertQueue(queueName, {});
            // this.logger.debug(`RabbitMqSubscriber queue asserted: ${JSON.stringify(this.options())} and url: ${url}`);

            await channel.bindQueue(queue.queue, exchangeName, routingKey);
            // this.logger.debug(`RabbitMqSubscriber queue bound: ${JSON.stringify(this.options())} and url: ${url}`);

            // Consume messages from the queue
            channel.consume(
                queue.queue,
                async (rawMessage) => {
                    if (rawMessage) {
                        const messageContentString = rawMessage.content.toString();
                        this.logger.debug(`RabbitMqSubscriber Received raw message: ${messageContentString}`);

                        let message: QueueMessage<T> = null;

                        try {
                            message = JSON.parse(messageContentString) as QueueMessage<T>;

                            // this is the first time we are receiving the message so we set the currentRetry to 0
                            if (!message.retryCount) message.retryCount = 0;
                            if (!message.retryInterval) message.retryInterval = 1000;
                            if (!message.currentRetry) message.currentRetry = 0;

                            await this.processMessage(message, rawMessage, channel);
                        }
                        catch (error) {
                            this.logger.error(`Error processing message: ${error.message}`);

                            // if an error occurs then if retryCount is set we start retrying. 
                            if (message) {
                                if (message.currentRetry < message.retryCount) {
                                    await this.updateStatusInDatabase('retrying', message);

                                    message.currentRetry++;
                                    this.logger.warn(`Retrying message (${message.currentRetry}/${message.retryCount}) after ${message.retryInterval}ms`);
                                    setTimeout(() => {
                                        this.retryMessage(message, rawMessage, channel);
                                    }, message.retryInterval);
                                } else {
                                    await this.updateStatusInDatabase('failed', message, error.message, '');

                                    this.logger.error(`Message failed after ${message.retryCount} attempts: ${error.message}`);
                                    channel.ack(rawMessage); // Discard the message after max retries
                                }
                            }

                        }
                    }
                },
                // { noAck: true },
                {},
            );

            this.logger.log(`RabbitMqSubscriber ready to consume messages: ${JSON.stringify(this.options())} and url: ${this.url}`);
        }
    }

    /**
     * Abstract method for message processing logic.
     */
    protected async processMessage(message: QueueMessage<T>, rawMessage, channel): Promise<void> {
        await this.updateStatusInDatabase('started', message);

        // Capture the results of handling the task.
        const result = await this.subscribe(message);

        // Ack the message. 
        channel.ack(rawMessage);

        // TODO: Update the database to indicate that the task is finished.
        await this.updateStatusInDatabase('succeeded', message, '', result ? JSON.stringify(result, null, 2) : '');

    }

    /**
     * Retry the message by invoking the processing logic again.
     */
    private async retryMessage(message: QueueMessage<T>, rawMessage, channel) {
        try {
            await this.processMessage(message, rawMessage, channel);
        } catch (error) {
            if (message.currentRetry < message.retryCount) {
                await this.updateStatusInDatabase('retrying', message);

                message.currentRetry++;
                this.logger.warn(`Retrying message (${message.currentRetry}/${message.retryCount}) after ${message.retryInterval}ms: ${error.message}`);
                setTimeout(() => {
                    this.retryMessage(message, rawMessage, channel);
                }, message.retryInterval);
            } else {

                this.logger.error(`Message failed after ${message.retryCount} attempts: ${error.message}`);

                // Discard the message after max retries
                channel.ack(rawMessage);

                // TODO: Store the error in the database and update the status accordingly.
                await this.updateStatusInDatabase('failed', message, error.message, '');

            }
        }
    }

    private async updateStatusInDatabase(stage: string, message: QueueMessage<T>, error: string = '', result: string = '') {

        // TODO: make an entry in the relevant database table, generate a unique id earlier.
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
        catch (error) {
            this.logger.error(error.message, error.stack);
        }

    }

}