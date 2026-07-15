import { BrokerType } from "src/interfaces";

const QUEUE_NAME = 'solid_chatter_mention_notification_email_queue_database';

export default {
    name: QUEUE_NAME,
    type: BrokerType.Database,
    queueName: QUEUE_NAME,
};
