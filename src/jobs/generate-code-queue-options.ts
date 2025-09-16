import { BrokerType } from "../interfaces";

const QUEUE_NAME = 'generate_code_queue_rabbitmq';

export default {
    name: 'generateCodeQueueRabbitmq',
    type: BrokerType.RabbitMQ,
    queueName: QUEUE_NAME,
};
