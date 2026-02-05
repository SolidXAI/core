import { BrokerType } from "src/interfaces";

const WHATSAPP_QUEUE_NAME = 'solid_msg91_whatsapp_queue_database';

export default {
    name: WHATSAPP_QUEUE_NAME,
    type: BrokerType.Database,
    queueName: WHATSAPP_QUEUE_NAME,
};