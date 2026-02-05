import { BrokerType } from "src/interfaces";

const WHATSAPP_QUEUE_NAME = 'solid_three60_whatsapp_queue_database';

export default {
    name: 'whatsappInstance',
    type: BrokerType.Database,
    queueName: WHATSAPP_QUEUE_NAME,
};