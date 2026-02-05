import { BrokerType } from "../../interfaces";

const QUEUE_NAME = 'solid_generate_code_queue_database';

export default {
    name: 'generateCodeQueueDatabase',
    type: BrokerType.Database,
    queueName: QUEUE_NAME,
};
