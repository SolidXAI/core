import { QueueMessage } from 'src/interfaces/mq';
import { BrokerType } from "../interfaces";

const API_MAIL_QUEUE_NAME = 'solid_api_mail_queue';

export default {
    name: API_MAIL_QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: API_MAIL_QUEUE_NAME,
};
