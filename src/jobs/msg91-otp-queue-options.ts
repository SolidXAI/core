import { QueueMessage } from 'src/interfaces/mq';

import { BrokerType } from "../interfaces";

const OTP_QUEUE_NAME = 'otp_queue';
export default {
    name: 'otpInstance',
    type: BrokerType.RabbitMQ,
    queueName: OTP_QUEUE_NAME,
    // receive: async (message: QueueMessage<any>) => { // Default receive handler
    //     console.log(`Received message: ${JSON.stringify(message)} from queue ${SMS_QUEUE_NAME}`);
    //     return 'Received';
    // },
};