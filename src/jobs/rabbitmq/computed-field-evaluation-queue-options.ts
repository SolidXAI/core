import { BrokerType } from "../../interfaces";

const QUEUE_NAME = 'solid_computed_field_evaluation_queue';

export default {
    name: QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: QUEUE_NAME,
    prefetch: 10,
    persistToDatabase: false,
};
