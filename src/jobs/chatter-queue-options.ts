import { BrokerType } from "../interfaces";

const QUEUE_NAME = 'solid_chatter_queue_rabbitmq';

export default {
    name: QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: QUEUE_NAME,
};
