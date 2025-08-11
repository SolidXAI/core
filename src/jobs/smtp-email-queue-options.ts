import { QueueMessage } from 'src/interfaces/mq';
import { BrokerType } from "../interfaces";

const MAIL_QUEUE_NAME = 'solid_email_queue_v3';

export default {
    name: 'solidEmailInstance',
    type: BrokerType.RabbitMQ,
    queueName: MAIL_QUEUE_NAME,
    // receive: async (message: QueueMessage<any>) => { // Default receive handler
    //     console.log(`Received message: ${JSON.stringify(message)} from queue ${MAIL_QUEUE_NAME}`);
    //     return 'Received';
    // },
};
