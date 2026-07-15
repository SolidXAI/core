import { BrokerType } from "src/interfaces";

const QUEUE_NAME = 'solid_chatter_mention_notification_email_queue';

export default {
    name: QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: QUEUE_NAME,
};
