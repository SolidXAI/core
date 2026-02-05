import { BrokerType } from "../interfaces";

const _WHATSAPP_QUEUE_NAME = 'solid_three60_whatsapp_queue';
export default {
    name: 'whatsappInstance',
    type: BrokerType.RabbitMQ,
    queueName: _WHATSAPP_QUEUE_NAME,
    // receive: async (message: QueueMessage<any>) => { // Default receive handler
    //     console.log(`Received message: ${JSON.stringify(message)} from queue ${SMS_QUEUE_NAME}`);
    //     return 'Received';
    // },
};