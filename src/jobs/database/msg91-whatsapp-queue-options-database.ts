import { BrokerType } from "src/interfaces";

const WHATSAPP_QUEUE_NAME = 'msg91_whatsapp_queue_database';

export default {
    name: 'whatsappInstance',
    type: BrokerType.Database,
    queueName: WHATSAPP_QUEUE_NAME,
};