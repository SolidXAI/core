import { QueueMessage } from 'src/interfaces/mq';
import { BrokerType } from "../interfaces";

const API_MAIL_QUEUE_NAME = 'solid_api_mail_queue';

export default {
    name: 'apiMailInstance',
    type: BrokerType.RabbitMQ,
    queueName: API_MAIL_QUEUE_NAME,
    // receive: async (message: QueueMessage<any>) => { // Default receive handler
    //     console.log(`Received message: ${JSON.stringify(message)} from queue ${MAIL_QUEUE_NAME}`);
    //     return 'Received';
    // },
};
