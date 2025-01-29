import { BrokerType } from "../interfaces";

const WHATSAPP_QUEUE_NAME = 'whatsapp_queue';
export default {
    name: 'whatsappInstance',
    type: BrokerType.RabbitMQ,
    queueName: WHATSAPP_QUEUE_NAME,
    // receive: async (message: QueueMessage<any>) => { // Default receive handler
    //     console.log(`Received message: ${JSON.stringify(message)} from queue ${SMS_QUEUE_NAME}`);
    //     return 'Received';
    // },
};