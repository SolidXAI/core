import { Injectable, Logger } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import testQueueConfig from './test-queue-options-database';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import { PollerService } from 'src/services/poller.service';

@Injectable()
export class TestQueueSubscriberDatabase extends DatabaseSubscriber<any> {
    private readonly testQueueLogger = new Logger(TestQueueSubscriberDatabase.name);
    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
    }

    options(): QueuesModuleOptions {
        return {
            ...testQueueConfig
        }
    }

    subscribe(message: QueueMessage<any>) {
        // console.log(`Received message ${JSON.stringify(message)}`);
        this.testQueueLogger.debug(`Received message: ${JSON.stringify(message)}`);

        let timeoutSecondsParsed = 10;
        const timeoutSeconds = message?.payload?.timeoutSeconds;
        if (timeoutSeconds) {
            timeoutSecondsParsed = +timeoutSeconds;
        }

        this.testQueueLogger.debug(`Processing message with timeout: ${timeoutSecondsParsed}`);

        // Simulate some processing time
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.testQueueLogger.debug(`Processed message: ${JSON.stringify(message)}`);
                resolve({ status: 'success', messageId: message.messageId, message: `Processed message` });
            }, timeoutSecondsParsed * 1000);
        });
    }
}
