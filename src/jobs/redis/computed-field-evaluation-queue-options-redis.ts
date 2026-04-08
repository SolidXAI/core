import { BrokerType } from "../../interfaces";

const QUEUE_NAME = 'solid_computed_field_evaluation_queue_redis';

export default {
    name: QUEUE_NAME,
    type: BrokerType.Redis,
    queueName: QUEUE_NAME,
    prefetch: 20
};
