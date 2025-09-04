import { Logger, OnModuleInit } from '@nestjs/common';
import { QueuesModuleOptions } from "../../interfaces";
import { QueueMessage, QueueSubscriber } from '../../interfaces/mq';
import { MqMessageQueueService } from '../mq-message-queue.service';
import { MqMessageService } from '../mq-message.service';
import { PollerService } from '../poller.service';


export abstract class DatabaseSubscriber<T> implements OnModuleInit, QueueSubscriber<T> {
    private readonly logger = new Logger(DatabaseSubscriber.name);
    private readonly url: string;
    private readonly serviceRole: string;

    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
        protected readonly poller: PollerService,
    ) {
        this.serviceRole = process.env.QUEUES_SERVICE_ROLE;
        if (!this.serviceRole) {
            this.logger.debug('Queue service Role is not defined in the environment variables');
        }
        this.logger.debug(`DatabaseSubscriber instance created with options: ${JSON.stringify(this.options())}`);
    }

    abstract subscribe(message: QueueMessage<T>);

    abstract options(): QueuesModuleOptions;

    private async processNext(queueName: string) {
        // this.logger.debug(`#### DatabaseSubscriber processing next message from queue: ${queueName}`);
        const job = await this.mqMessageService.lockNextPendingMessage(queueName);
        if (!job) {
            return;
        }

        const messageContentString = job.input.toString();
        // this.logger.debug(`DatabaseSubscriber Received raw message: ${messageContentString}`);

        let message: QueueMessage<T> = null;

        try {
            message = JSON.parse(messageContentString) as QueueMessage<T>;

            // this is the first time we are receiving the message so we set the currentRetry to 0
            if (!message.retryCount) message.retryCount = 0;
            if (!message.retryInterval) message.retryInterval = 1000;
            if (!message.currentRetry) message.currentRetry = 0;

            await this.processMessage(message);
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
                        this.retryMessage(message);
                    }, message.retryInterval);
                } else {
                    // Discard the message after max retries
                    await this.updateStatusInDatabase('failed', message, error.message, '');
                    this.logger.error(`Message failed after ${message.retryCount} attempts: ${error.message}`);
                }
            }
        }
        // this.logger.debug(`#### DatabaseSubscriber finished processing message from queue: ${queueName}`);
    }

    // async onModuleInit(): Promise<void> {
    //     // we will start subscriber only if the current service role is subscriber. 
    //     if (['both', 'subscriber'].includes(this.serviceRole)) {

    //         const options = this.options();

    //         const queueName = options.queueName;
    //         // setInterval(() => this.processNext(queueName), 1000);
    //         const poll = async () => {
    //             try {
    //                 await this.processNext(queueName);
    //             } catch (err) {
    //                 this.logger.error(`Polling error: ${err.message}`);
    //             } finally {
    //                 setTimeout(poll, 1000); // Wait 1s *after* processing finishes
    //             }
    //         };

    //         // start the loop
    //         poll();

    //         this.logger.log(`DatabaseSubscriber ready to consume messages: ${JSON.stringify(this.options())}`);
    //     }
    // }

    async onModuleInit(): Promise<void> {
        // we will start subscriber only if the current service role is subscriber. 
        if (['both', 'subscriber'].includes(this.serviceRole)) {

            const options = this.options();

            const queueName = options.queueName;

            this.poller.start(queueName, (q) => this.processNext(q), {
                baseDelayMs: 1000,
                maxDelayMs: 30_000,
                timeoutPerIterationMs: 5 * 60_000,
                jitter: true,
            });

            this.logger.log(`DatabaseSubscriber ready to consume messages: ${JSON.stringify(this.options())}`);
        }
    }

    onModuleDestroy() {
        const options = this.options();
        const queueName = options.queueName;
        this.poller.stop(queueName);
    }

    /**
     * Abstract method for message processing logic.
     */
    protected async processMessage(message: QueueMessage<T>): Promise<void> {
        await this.updateStatusInDatabase('started', message);

        // Capture the results of handling the task.
        const result = await this.subscribe(message);

        // TODO: Update the database to indicate that the task is finished.
        await this.updateStatusInDatabase('succeeded', message, '', result ? JSON.stringify(result, null, 2) : '');
    }

    /**
     * Retry the message by invoking the processing logic again.
     */
    private async retryMessage(message: QueueMessage<T>) {
        try {
            await this.processMessage(message);
        } catch (error) {
            if (message.currentRetry < message.retryCount) {
                await this.updateStatusInDatabase('retrying', message);

                message.currentRetry++;
                this.logger.warn(`Retrying message (${message.currentRetry}/${message.retryCount}) after ${message.retryInterval}ms: ${error.message}`);
                setTimeout(() => {
                    this.retryMessage(message);
                }, message.retryInterval);
            } else {
                this.logger.error(`Message failed after ${message.retryCount} attempts: ${error.message}`);

                // TODO: Store the error in the database and update the status accordingly.
                await this.updateStatusInDatabase('failed', message, error.message, '');

            }
        }
    }

    private async updateStatusInDatabase(stage: string, message: QueueMessage<T>, error: string = '', result: string = '') {
        try {
            this.logger.debug(`Updating message status in database: ${stage} for messageId: ${message.messageId}`);

            // 1. resolve the queue first
            const mqMessage = await this.mqMessageService.repo.findOne({
                where: {
                    messageId: message.messageId,
                }
            });

            if (mqMessage) {
                this.logger.debug(`Found message in database: ${JSON.stringify(mqMessage.messageId)}`);
                this.logger.debug(`Updating message status in database: ${stage} for messageId: ${mqMessage.id}`);

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
                this.logger.debug(`Message status updated to ${stage} for messageId: ${mqMessage.id}`);
            }
        }
        catch (error) {
            this.logger.error(error.message, error.stack);
        }
    }
}
