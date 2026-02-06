import { BrokerType } from "../interfaces";

const MSG91_WHATSAPP_QUEUE_NAME = 'solid_msg91_whatsapp_queue';

export default {
    name: MSG91_WHATSAPP_QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: MSG91_WHATSAPP_QUEUE_NAME,
};
