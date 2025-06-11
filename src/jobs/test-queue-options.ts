import { QueueMessage } from 'src/interfaces/mq';
import { BrokerType } from "../interfaces";

const QUEUE_NAME = 'test_queue';

export default {
    name: 'queueTest',
    type: BrokerType.RabbitMQ,
    queueName: QUEUE_NAME,
    // receive: async (message: QueueMessage<any>) => { // Default receive handler
    //     console.log(`Received message: ${JSON.stringify(message)} from queue ${MAIL_QUEUE_NAME}`);
    //     return 'Received';
    // },
};
