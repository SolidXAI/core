import { BrokerType } from "../../interfaces";

const QUEUE_NAME = 'solid_generate_code_queue_redis';

export default {
    name: QUEUE_NAME,
    type: BrokerType.Redis,
    queueName: QUEUE_NAME,
};
