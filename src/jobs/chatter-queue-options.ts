import { BrokerType } from "../interfaces";

const QUEUE_NAME = 'solid_chatter_queue';

export default {
    name: 'queueChatter',
    type: BrokerType.RabbitMQ,
    queueName: QUEUE_NAME,
};
