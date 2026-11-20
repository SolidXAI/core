import { Injectable } from '@nestjs/common';

import { RabbitMqPublisher } from 'src/services/queues/rabbitmq-publisher.service';
import odooChatterImportQueueOptions, { OdooChatterImportQueuePayload } from './odoo-chatter-import-queue-options';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { QueuesModuleOptions } from "../../interfaces";

@Injectable()
export class OdooChatterImportQueuePublisherRabbitmq extends RabbitMqPublisher<OdooChatterImportQueuePayload> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...odooChatterImportQueueOptions
        }
    }
}
