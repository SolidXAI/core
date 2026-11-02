import { Injectable, Logger } from '@nestjs/common';

import { RabbitMqSubscriber } from 'src/services/queues/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import odooChatterImportQueueOptions, { OdooChatterImportQueuePayload } from './odoo-chatter-import-queue-options';
import { ChatterMessageService } from 'src/services/chatter-message.service';

@Injectable()
export class OdooChatterImportQueueSubscriberRabbitmq extends RabbitMqSubscriber<OdooChatterImportQueuePayload> {
    private readonly importLogger = new Logger(OdooChatterImportQueueSubscriberRabbitmq.name);

    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        private readonly chatterMessageService: ChatterMessageService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...odooChatterImportQueueOptions
        }
    }

    async subscribe(message: QueueMessage<OdooChatterImportQueuePayload>) {
        const p = message.payload;
        this.importLogger.log(`Starting Odoo chatter import: odoo model "${p.odooModelName}" -> solidx model "${p.solidxModelName}"${p.odooId ? ` (odooId=${p.odooId} only)` : ''}`);

        const summary = await this.chatterMessageService.runOdooChatterImport(p);

        this.importLogger.log(`Finished Odoo chatter import: odoo model "${p.odooModelName}" -> solidx model "${p.solidxModelName}" :: ${JSON.stringify(summary)}`);
        return summary;
    }
}
