import { BrokerType } from "src/interfaces";

const WHATSAPP_QUEUE_NAME = 'whatsapp_queue_database';

export default {
    name: 'whatsappInstance',
    type: BrokerType.Database,
    queueName: WHATSAPP_QUEUE_NAME,
};