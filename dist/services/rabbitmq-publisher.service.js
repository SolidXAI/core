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
var RabbitMqPublisher_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMqPublisher = void 0;
const uuid_1 = require("uuid");
const common_1 = require("@nestjs/common");
const amqp = require("amqplib");
const mq_message_queue_service_1 = require("./mq-message-queue.service");
const mq_message_service_1 = require("./mq-message.service");
let RabbitMqPublisher = RabbitMqPublisher_1 = class RabbitMqPublisher {
    constructor(mqMessageService, mqMessageQueueService) {
        this.mqMessageService = mqMessageService;
        this.mqMessageQueueService = mqMessageQueueService;
        this.logger = new common_1.Logger(RabbitMqPublisher_1.name);
        const url = process.env.QUEUES_RABBIT_MQ_URL;
        this.logger.debug(`RabbitMqPublisher instance created with options: ${JSON.stringify(this.options())} and url: ${url}`);
    }
    async publish(message) {
        const url = process.env.QUEUES_RABBIT_MQ_URL;
        this.logger.debug(`RabbitMqPublisher publishing with options: ${JSON.stringify(this.options())} and url: ${url}`);
        const connection = await amqp.connect(url);
        const channel = await connection.createChannel();
        const options = this.options();
        const queueName = options.queueName;
        const exchangeName = `${queueName}.exchange`;
        const routingKey = `${queueName}.routing-key`;
        await channel.assertExchange(exchangeName, 'direct', {});
        const queue = await channel.assertQueue(queueName, {});
        await channel.bindQueue(queue.queue, exchangeName, routingKey);
        if (!message.retryCount)
            message.retryCount = 0;
        if (!message.retryInterval)
            message.retryInterval = 1000;
        message.messageId = (0, uuid_1.v4)();
        await this.persistToDatabase(queueName, message);
        try {
            const publishStatus = channel.publish(exchangeName, routingKey, Buffer.from(JSON.stringify(message)), { mandatory: true });
        }
        catch (err) {
            this.logger.error(`RabbitMqPublisher Message publish failed: ${JSON.stringify(err)}`);
            if (err instanceof Error) {
                this.logger.error(`RabbitMqPublisher Error stack: ${err.stack}`);
            }
        }
        finally {
        }
        return message.messageId;
    }
    async persistToDatabase(queueName, message) {
        try {
            const mqMessageQueue = await this.mqMessageQueueService.resolveQueue(queueName);
            await this.mqMessageService.create({
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
};
exports.RabbitMqPublisher = RabbitMqPublisher;
exports.RabbitMqPublisher = RabbitMqPublisher = RabbitMqPublisher_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mq_message_service_1.MqMessageService,
        mq_message_queue_service_1.MqMessageQueueService])
], RabbitMqPublisher);
//# sourceMappingURL=rabbitmq-publisher.service.js.map