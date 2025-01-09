import { QueueMessage } from 'src/interfaces/mq';

import { BrokerType } from "../interfaces";

const SMS_QUEUE_NAME = 'sms_queue';
export default {
    name: 'smsInstance',
    type: BrokerType.RabbitMQ,
    queueName: SMS_QUEUE_NAME,
    // receive: async (message: QueueMessage<any>) => { // Default receive handler
    //     console.log(`Received message: ${JSON.stringify(message)} from queue ${SMS_QUEUE_NAME}`);
    //     return 'Received';
    // },
};