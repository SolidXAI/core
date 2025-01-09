import { OnModuleInit } from '@nestjs/common';
import { QueueMessage, QueueSubscriber } from '../interfaces/mq';
import { MqMessageService } from './mq-message.service';
import { MqMessageQueueService } from './mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";
export declare abstract class RabbitMqSubscriber<T> implements OnModuleInit, QueueSubscriber<T> {
    protected readonly mqMessageService: MqMessageService;
    protected readonly mqMessageQueueService: MqMessageQueueService;
    private readonly logger;
    constructor(mqMessageService: MqMessageService, mqMessageQueueService: MqMessageQueueService);
    abstract subscribe(message: QueueMessage<T>): any;
    abstract options(): QueuesModuleOptions;
    onModuleInit(): Promise<void>;
    protected processMessage(message: QueueMessage<T>, rawMessage: any, channel: any): Promise<void>;
    private retryMessage;
    private updateStatusInDatabase;
}
