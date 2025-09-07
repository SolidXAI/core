import { BrokerType } from "../interfaces";

const MSG91_WHATSAPP_QUEUE_NAME = 'mag_91_whatsapp_queue';
export default {
    name: 'whatsappInstance',
    type: BrokerType.RabbitMQ,
    queueName: MSG91_WHATSAPP_QUEUE_NAME,
    // receive: async (message: QueueMessage<any>) => { // Default receive handler
    //     console.log(`Received message: ${JSON.stringify(message)} from queue ${SMS_QUEUE_NAME}`);
    //     return 'Received';
    // },
};