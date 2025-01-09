"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RabbitMqSubscriber_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMqSubscriber = void 0;
const common_1 = require("@nestjs/common");
const amqp = require("amqplib");
const mq_message_service_1 = require("./mq-message.service");
const mq_message_queue_service_1 = require("./mq-message-queue.service");
let RabbitMqSubscriber = RabbitMqSubscriber_1 = class RabbitMqSubscriber {
    constructor(mqMessageService, mqMessageQueueService) {
        this.mqMessageService = mqMessageService;
        this.mqMessageQueueService = mqMessageQueueService;
        this.logger = new common_1.Logger(RabbitMqSubscriber_1.name);
    }
    async onModuleInit() {
        if (['both', 'subscriber'].includes(process.env.QUEUES_SERVICE_ROLE)) {
            const url = process.env.QUEUES_RABBIT_MQ_URL;
            if (!url) {
                this.logger.warn(`Unable to create RabbitMqSubscriber instance: ${JSON.stringify(this.options())} as rabbitmq url is not configured.`);
                return;
            }
            const connection = await amqp.connect(url);
            const channel = await connection.createChannel();
            const options = this.options();
            const queueName = options.queueName;
            const exchangeName = `${queueName}.exchange`;
            const routingKey = `${queueName}.routing-key`;
            await channel.assertExchange(exchangeName, 'direct', {});
            const queue = await channel.assertQueue(queueName, {});
            await channel.bindQueue(queue.queue, exchangeName, routingKey);
            channel.consume(queue.queue, async (rawMessage) => {
                if (rawMessage) {
                    const messageContentString = rawMessage.content.toString();
                    this.logger.debug(`RabbitMqSubscriber Received raw message: ${messageContentString}`);
                    let message = null;
                    try {
                        message = JSON.parse(messageContentString);
                        if (!message.retryCount)
                            message.retryCount = 0;
                        if (!message.retryInterval)
                            message.retryInterval = 1000;
                        if (!message.currentRetry)
                            message.currentRetry = 0;
                        await this.processMessage(message, rawMessage, channel);
                    }
                    catch (error) {
                        this.logger.error(`Error processing message: ${error.message}`);
                        if (message) {
                            if (message.currentRetry < message.retryCount) {
                                await this.updateStatusInDatabase('retrying', message);
                                message.currentRetry++;
                                this.logger.warn(`Retrying message (${message.currentRetry}/${message.retryCount}) after ${message.retryInterval}ms`);
                                setTimeout(() => {
                                    this.retryMessage(message, rawMessage, channel);
                                }, message.retryInterval);
                            }
                            else {
                                await this.updateStatusInDatabase('failed', message, error.message, '');
                                this.logger.error(`Message failed after ${message.retryCount} attempts: ${error.message}`);
                                channel.ack(rawMessage);
                            }
                        }
                    }
                }
            }, {});
            this.logger.debug(`RabbitMqSubscriber ready to consume messages: ${JSON.stringify(this.options())} and url: ${url}`);
        }
    }
    async processMessage(message, rawMessage, channel) {
        await this.updateStatusInDatabase('started', message);
        const result = await this.subscribe(message);
        channel.ack(rawMessage);
        await this.updateStatusInDatabase('succeeded', message, '', result ? JSON.stringify(result, null, 2) : '');
    }
    async retryMessage(message, rawMessage, channel) {
        try {
            await this.processMessage(message, rawMessage, channel);
        }
        catch (error) {
            if (message.currentRetry < message.retryCount) {
                await this.updateStatusInDatabase('retrying', message);
                message.currentRetry++;
                this.logger.warn(`Retrying message (${message.currentRetry}/${message.retryCount}) after ${message.retryInterval}ms: ${error.message}`);
                setTimeout(() => {
                    this.retryMessage(message, rawMessage, channel);
                }, message.retryInterval);
            }
            else {
                this.logger.error(`Message failed after ${message.retryCount} attempts: ${error.message}`);
                channel.ack(rawMessage);
                await this.updateStatusInDatabase('failed', message, error.message, '');
            }
        }
    }
    async updateStatusInDatabase(stage, message, error = '', result = '') {
        try {
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
};
exports.RabbitMqSubscriber = RabbitMqSubscriber;
exports.RabbitMqSubscriber = RabbitMqSubscriber = RabbitMqSubscriber_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mq_message_service_1.MqMessageService,
        mq_message_queue_service_1.MqMessageQueueService])
], RabbitMqSubscriber);
//# sourceMappingURL=rabbitmq-subscriber.service.js.map