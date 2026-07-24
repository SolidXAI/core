import { BrokerType } from "src/interfaces";

const QUEUE_NAME = 'solid_chatter_mention_notification_email_queue_redis';

export default {
    name: QUEUE_NAME,
    type: BrokerType.Redis,
    queueName: QUEUE_NAME,
};
