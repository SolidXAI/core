import { BrokerType } from "../../interfaces";

const _WHATSAPP_QUEUE_NAME = 'solid_three60_whatsapp_queue';

export default {
    name: _WHATSAPP_QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: _WHATSAPP_QUEUE_NAME,
};
