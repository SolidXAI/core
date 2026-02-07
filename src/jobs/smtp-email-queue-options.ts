import { BrokerType } from "../interfaces";

const MAIL_QUEUE_NAME = 'solid_email_queue_v3';

export default {
    name: MAIL_QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: MAIL_QUEUE_NAME,
};
