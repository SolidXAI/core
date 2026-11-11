import { BrokerType } from "../../interfaces";

const QUEUE_NAME = 'solid_media_migration_queue';

export default {
    name: QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: QUEUE_NAME,
};
