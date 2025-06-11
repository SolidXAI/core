import { BrokerType } from "../../interfaces";

const QUEUE_NAME = 'test_queue_db';

export default {
    name: 'queueTestDb',
    type: BrokerType.Database,
    queueName: QUEUE_NAME,
    // receive: async (message: QueueMessage<any>) => { // Default receive handler
    //     console.log(`Received message: ${JSON.stringify(message)} from queue ${MAIL_QUEUE_NAME}`);
    //     return 'Received';
    // },
};
