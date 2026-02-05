import { BrokerType } from "../interfaces";

const QUEUE_NAME = 'solid_test_queue';

export default {
    name: QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: QUEUE_NAME,
};
